// ---- Settings: edit these ----
const CONFIG = {
  accessKey: "YOUR_WEB3FORMS_ACCESS_KEY", // free key from web3forms.com, sent to jhd7187@gmail.com
  confirmMinutes: 15                       // the "X minutes" in the confirmation message
};
const FEE = { mobile: 49, day: 35, night: 25, install: 30, disposal: 7, supplied: 40 };
// min/max are fixed prices. per = per-tire pricing. open = price can go higher. tire = tire cost is extra.
const ISSUES = {
  flat: { l: "Flat tire repair or spare swap", min: 79, max: 79 },
  roadside: { l: "Roadside emergency call", min: 79, max: 79 },
  new: { l: "New tire installation", qty: true, tire: true },
  supplied: { l: "Install your tires", qty: true },
  air: { l: "Air up and inspection", min: 59, max: 59 },
  bead: { l: "Bead reseat", min: 79, max: 79 },
  tpms: { l: "TPMS sensor installed", min: 75, max: 100 },
  trailer: { l: "Trailer tire change", min: 99, max: 99 },
  heavy: { l: "Heavy-duty or dually", min: 129, max: 129, open: true },
  unsure: { l: "Inspection or repair", min: 59, max: 79 }
};
const $ = (id) => document.getElementById(id);
let coords = null, map, marker, current = null;

function centralHour() {
  const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(new Date());
  return parseInt(h, 10) % 24;
}
const money = (a, b) => (a === b ? "$" + a : "$" + a + " to $" + b);

function estimate() {
  const d = ISSUES[$("issue").value];
  $("qtyrow").hidden = !(d && d.qty);
  if (!d) { $("est").hidden = true; current = null; return; }
  const q = d.qty ? +$("qty").value : 1, lines = [];
  if ($("issue").value === "new") {
    lines.push([q + " x installation", FEE.install * q, FEE.install * q]);
    lines.push([q + " x old tire disposal", FEE.disposal * q, FEE.disposal * q]);
  } else if (d.qty) lines.push([q + " x " + d.l, FEE.supplied * q, FEE.supplied * q]);
  else lines.push([d.l, d.min, d.max]);
  lines.push(["Mobile service fee", FEE.mobile, FEE.mobile]);
  const h = centralHour();
  if (h < 7 || h >= 19) lines.push(["After-hours emergency fee", FEE.day, FEE.day]);
  if (h >= 22 || h < 7) lines.push(["Overnight fee", FEE.night, FEE.night]);
  const min = lines.reduce((s, x) => s + x[1], 0), max = lines.reduce((s, x) => s + x[2], 0);
  let t = money(min, max) + (d.open ? "+" : "") + (d.tire ? " + tires" : "");
  $("total").textContent = t;
  $("lines").innerHTML = lines.map((x) => "<li><span>" + x[0] + "</span><span>" + money(x[1], x[2]) + "</span></li>").join("") + (d.tire ? "<li><span>Tires</span><span>Quoted by technician</span></li>" : "");
  $("estnote").textContent = "A technician confirms the final price before any work starts.";
  $("est").hidden = false; current = t;
}
$("issue").addEventListener("change", estimate);
$("qty").addEventListener("change", estimate);

function setPin(lat, lng) {
  coords = { lat, lng };
  $("map").style.display = "block";
  if (!map) {
    map = L.map("map").setView([lat, lng], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on("dragend", () => { const p = marker.getLatLng(); coords = { lat: p.lat, lng: p.lng }; });
  } else { map.setView([lat, lng], 16); marker.setLatLng([lat, lng]); }
  map.invalidateSize();
  $("locmsg").textContent = "Pin placed at your location. Drag it if it is off.";
}
$("loc").addEventListener("click", () => {
  if (!navigator.geolocation) { $("locmsg").textContent = "Location is not available in this browser. Enter your address below."; return; }
  $("locmsg").textContent = "Finding your location...";
  navigator.geolocation.getCurrentPosition(
    (p) => setPin(p.coords.latitude, p.coords.longitude),
    () => { $("locmsg").textContent = "We could not get your location. Allow location access or enter your address below."; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
});

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = $("f"), err = $("err"); err.textContent = "";
  const spare = f.querySelector('input[name="Has spare"]:checked');
  if (!$("issue").value) return (err.textContent = "Choose what is wrong.", $("issue").focus());
  if (!spare) return (err.textContent = "Tell us whether you have a spare.");
  for (const n of ["Year", "Make", "Model"]) if (!f.elements[n].value.trim()) return (err.textContent = "Choose your vehicle year and enter the make and model.", f.elements[n].focus());
  if (!coords && !$("addr").value.trim()) return (err.textContent = "Share your location or enter an address.");
  if (!$("name").value.trim()) return (err.textContent = "Enter your name.", $("name").focus());
  if ($("phone").value.replace(/\D/g, "").length < 10) return (err.textContent = "Enter a 10 digit mobile number so we can text you.", $("phone").focus());

  const fd = new FormData(f);
  fd.set("access_key", CONFIG.accessKey);
  fd.set("subject", "New tire request from " + $("name").value.trim());
  fd.set("from_name", "Rolling Tire Co. website");
  fd.set("Estimated total", current);
  fd.set("Received (Central)", new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  if (coords) fd.set("Map link", "https://www.google.com/maps?q=" + coords.lat + "," + coords.lng);
  if (!$("photo").files.length) fd.delete("attachment");
  $("go").disabled = true; $("go").textContent = "Sending...";
  try {
    const r = await fetch("https://api.web3forms.com/submit", { method: "POST", body: fd });
    const j = await r.json();
    if (!j.success) throw new Error(j.message);
    $("formwrap").innerHTML = '<div class="done" role="status"><h2>Request received.</h2><p>A technician will confirm your ETA by text within ' + CONFIG.confirmMinutes + ' minutes at ' + $("phone").value.replace(/[<>&]/g, "") + '.</p><p>Estimated total: <strong>' + current + '</strong>. We confirm the final price before work starts.</p><p>Need us sooner? Call <a href="tel:+14696424864">469-642-4864</a>.</p></div>';
    window.scrollTo(0, 0);
  } catch (x) {
    err.textContent = "Your request did not send. Please try again or call 469-642-4864.";
    $("go").disabled = false; $("go").textContent = "Request technician";
  }
});

// ---- Vehicle search (U.S. NHTSA vPIC database, free, no key) ----
const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles/";
const POPULAR = ["Acura","Alfa Romeo","Audi","Bentley","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","Fiat","Ford","Genesis","GMC","Honda","Hyundai","Infiniti","Jaguar","Jeep","Kia","Land Rover","Lexus","Lincoln","Lucid","Maserati","Mazda","Mercedes-Benz","Mini","Mitsubishi","Nissan","Polestar","Porsche","Ram","Rivian","Subaru","Tesla","Toyota","Volkswagen","Volvo"];
const KEEP = { Bmw: "BMW", Gmc: "GMC", Mg: "MG", Amc: "AMC" };
const pretty = (n) => {
  n = n.trim();
  if (!/^[A-Z0-9 &.\-\/]+$/.test(n)) return n;
  const t = n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return KEEP[t] || t;
};
const fill = (id, arr) => {
  const dl = $(id), frag = document.createDocumentFragment();
  arr.forEach((v) => { const o = document.createElement("option"); o.value = v; frag.appendChild(o); });
  dl.replaceChildren(frag);
};
const vmsg = (t) => { $("vehmsg").textContent = t; };

(function years() {
  const sel = $("year"), top = new Date().getFullYear() + 1;
  for (let y = top; y >= 1980; y--) sel.add(new Option(y, y));
})();

fill("makes", POPULAR);
(async function loadMakes() {
  const types = ["car", "truck", "multipurpose passenger vehicle (mpv)"];
  const res = await Promise.allSettled(types.map((t) => fetch(VPIC + "GetMakesForVehicleType/" + encodeURIComponent(t) + "?format=json").then((r) => r.json())));
  const seen = new Set(POPULAR.map((m) => m.toLowerCase())), extra = [];
  res.forEach((r) => {
    if (r.status !== "fulfilled" || !r.value.Results) return;
    r.value.Results.forEach((x) => {
      const m = pretty(x.MakeName || ""), k = m.toLowerCase();
      if (m && !seen.has(k)) { seen.add(k); extra.push(m); }
    });
  });
  if (extra.length) fill("makes", POPULAR.concat(extra.sort()));
})();

const modelCache = {};
let modelToken = 0, timer;
async function loadModels() {
  const y = $("year").value, m = $("make").value.trim();
  if (!y || !m) return;
  const key = y + "|" + m.toLowerCase(), tok = ++modelToken;
  try {
    if (!modelCache[key]) {
      const r = await fetch(VPIC + "GetModelsForMakeYear/make/" + encodeURIComponent(m) + "/modelyear/" + y + "?format=json");
      const j = await r.json();
      modelCache[key] = [...new Set((j.Results || []).map((x) => x.Model_Name))].sort();
    }
    if (tok !== modelToken) return;
    fill("models", modelCache[key]);
    vmsg(modelCache[key].length ? modelCache[key].length + " models found for " + y + " " + m + ". Pick one or type your own." : "No models found for that year and make. Type your model in.");
  } catch (e) {
    vmsg("Vehicle search is unavailable right now. Type your make and model in.");
  }
}
$("year").addEventListener("change", loadModels);
$("make").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadModels, 450); });
$("make").addEventListener("change", () => { $("model").value = ""; loadModels(); });
