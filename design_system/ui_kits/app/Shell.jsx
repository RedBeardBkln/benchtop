const { Logo, Icon, Badge, Button } = window.DesignSystem_998768;
const nav = [["formulations","flask-conical","Formulations"],["trials","test-tubes","Trials"],["ingredients","wheat","Ingredients"],["assistant","sparkles","Ask benchtop"]];
function Sidebar({ screen, go }) {
  return <aside style={{ width: 232, background: "var(--ink-900)", color: "var(--ink-300)", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4, flex: "none" }}>
    <div style={{ padding: "4px 10px 22px" }}><Logo variant="wordmark" height={30} color="var(--lcd-300)" /></div>
    {nav.map(([id, ic, label]) => { const on = screen === id; return <button key={id} onClick={() => go(id)} style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 12px", border: 0, borderRadius: 8, cursor: "pointer", font: "500 15px var(--font-body)", background: on ? "var(--lcd-300)" : "transparent", color: on ? "var(--ink-900)" : "inherit", textAlign: "left" }}><Icon name={ic} size={18} />{label}</button>; })}
    <div style={{ marginTop: "auto", padding: 12, border: "1px solid var(--ink-700)", borderRadius: 10, font: "400 12px/1.5 var(--font-mono)" }}>bench: <span style={{ color: "var(--lcd-300)" }}>Snack R&D</span><br />3 trials running</div>
  </aside>;
}
function PageHead({ title, sub, actions }) {
  return <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}><div><div className="label">{sub}</div><h2 style={{ fontSize: 40, marginTop: 6 }}>{title}</h2></div><div style={{ display: "flex", gap: 10 }}>{actions}</div></div>;
}
Object.assign(window, { Sidebar, PageHead });