(function(){
  let labels = [];
  let loaded = false;

  function safeText(value){
    return String(value ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[m]));
  }

  async function loadLabels(){
    try{
      const res = await fetch("/api/order-center");
      const data = await res.json();

      labels = (data.labels || []).map(l => ({
        id: l.id || "",
        name: l.name || l.id || "Unbekannt",
        icon: "🏷️",
        entities: Number(l.entity_count || l.entities || 0),
        devices: Number(l.device_count || l.devices || 0),
        raw: l
      }));

      loaded = true;
    }catch(e){
      console.error("Labels API Fehler:", e);
      labels = [];
      loaded = true;
    }
  }

  function render(){
    const grid = document.getElementById("labelsGrid");
    if(!grid) return;

    const q = (document.getElementById("labelsSearch")?.value || "").toLowerCase();
    const f = document.getElementById("labelsFilter")?.value || "all";

    let list = labels.filter(l => l.name.toLowerCase().includes(q));

    if(f === "used") list = list.filter(l => l.entities > 0 || l.devices > 0);
    if(f === "unused") list = list.filter(l => l.entities === 0 && l.devices === 0);

    document.getElementById("labelsTotal").textContent = labels.length;
    document.getElementById("labelsUsed").textContent =
      labels.filter(l => l.entities > 0 || l.devices > 0).length;
    document.getElementById("labelsUnused").textContent =
      labels.filter(l => l.entities === 0 && l.devices === 0).length;

    if(!loaded){
      grid.innerHTML = `<div class="label-card"><h3>⏳ Lade Labels...</h3></div>`;
      return;
    }

    if(list.length === 0){
      grid.innerHTML = `<div class="label-card"><h3>Keine Labels gefunden</h3></div>`;
      return;
    }

    grid.innerHTML = list.map((l,i)=>`
      <div class="label-card" data-index="${i}">
        <h3>${l.icon} ${safeText(l.name)}</h3>
        <p>${l.entities} Entitäten · ${l.devices} Geräte</p>
      </div>
    `).join("");

    grid.querySelectorAll(".label-card").forEach((card,i)=>{
      card.addEventListener("click",()=>{
        const l = list[i];
        document.getElementById("labelsDetails").innerHTML = `
          <h3>${l.icon} ${safeText(l.name)}</h3>
          <p><b>${l.entities}</b> Entitäten</p>
          <p><b>${l.devices}</b> Geräte</p>
          <p>${(l.entities > 0 || l.devices > 0) ? "Aktiv genutzt" : "Ungenutzt"}</p>
          <p><small>ID: ${safeText(l.id)}</small></p>
        `;
      });
    });
  }

  async function init(){
    if(!document.getElementById("phoenixLabelsPage")) return;

    document.getElementById("labelsSearch")?.addEventListener("input", render);
    document.getElementById("labelsFilter")?.addEventListener("change", render);

    render();

    if(!loaded){
      await loadLabels();
      render();
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  const obs = new MutationObserver(init);
  obs.observe(document.body,{childList:true,subtree:true});
})();
