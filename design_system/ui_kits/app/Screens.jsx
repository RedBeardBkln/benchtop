const { Card, Badge, Button, Input, Tabs, Switch, SegmentDisplay, Icon, Tooltip } = window.DesignSystem_998768;
const forms = [["Oat & Almond Bar","OAB-v4","Bars","ok","stable","aw 0.62","12.4"],["Probiotic Gummy","PGM-v2","Confection","warn","review","aw 0.55","31.0"],["Plant Cheese Slice","PCS-v7","Dairy-alt","neutral","draft","aw 0.97","1.2"],["Protein Crisps","PRC-v1","Snacks","danger","fail","aw 0.38","4.8"]];
function FormulationList({ open }) {
  return <div><PageHead sub="Snack R&D bench" title="Formulations" actions={<><Button variant="ghost" icon="filter">Filter</Button><Button icon="plus">New formulation</Button></>} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 20 }}>
      {forms.map(([n, id, cat, tone, st, aw, sug]) => <div key={id} onClick={() => open(id)} style={{ cursor: "pointer" }}><Card title={n} action={<Badge tone={tone} dot>{st}</Badge>}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div><div className="label">Sugars g/100g</div><div style={{ marginTop: 8 }}><SegmentDisplay value={sug} height={40} /></div></div>
          <div style={{ textAlign: "right", font: "400 13px/1.7 var(--font-mono)", color: "var(--fg-2)" }}>{id}<br />{cat} · {aw}</div></div></Card></div>)}
    </div></div>;
}
const rows0 = [["Rolled oats",38.0],["Almond butter",16.5],["Glucose syrup",14.0],["Sucrose",12.4],["Pea protein",10.0],["Sea salt",0.6],["Natural flavour",0.5]];
function Editor() {
  const [tab, setTab] = React.useState("f"); const [rows, setRows] = React.useState(rows0); const [applied, setApplied] = React.useState(false);
  const total = rows.reduce((a, r) => a + r[1], 0);
  const apply = () => { setApplied(true); setRows(r => r.map(x => x[0] === "Glucose syrup" ? [x[0], 10.0] : x[0] === "Allulose" ? x : x).concat([["Allulose", 4.0]])); };
  return <div><PageHead sub="OAB-v4 · rev c" title="Oat & Almond Bar" actions={<><Button variant="ghost" icon="git-compare">Compare</Button><Button variant="secondary" icon="play">Run trial</Button></>} />
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Tabs value={tab} onChange={setTab} items={[{ id: "f", label: "Formula" }, { id: "t", label: "Trials" }, { id: "s", label: "Specs" }]} />
        <Card padding={0}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", padding: "12px 20px", borderBottom: "1.5px solid var(--ink-900)" }} className="label"><span>Ingredient</span><span style={{ textAlign: "right" }}>% w/w</span></div>
          {rows.map(([n, q], i) => <div key={n} style={{ display: "grid", gridTemplateColumns: "1fr 120px", padding: "10px 20px", borderBottom: "1px solid var(--ink-200)", alignItems: "center", background: n === "Allulose" ? "var(--lcd-100)" : "transparent" }}><span style={{ display: "flex", gap: 10, alignItems: "center" }}>{n}{n === "Allulose" && <Badge tone="warm">AI</Badge>}</span><span className="mono" style={{ textAlign: "right", fontSize: 16 }}>{q.toFixed(1)}</span></div>)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", padding: "14px 20px", background: "var(--ink-900)", color: "var(--lcd-300)" }}><b>Total</b><span className="mono" style={{ textAlign: "right", fontSize: 16 }}>{total.toFixed(1)}</span></div>
        </Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card tone="lcd"><div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}><div><div className="label" style={{ color: "var(--ink-800)", whiteSpace: "nowrap" }}>Water act.</div><SegmentDisplay value={applied ? "0.58" : "0.62"} height={34} /></div><div><div className="label" style={{ color: "var(--ink-800)", whiteSpace: "nowrap" }}>Sugars</div><SegmentDisplay value={applied ? "8.4" : "12.4"} height={34} /></div></div></Card>
        <Card title="Ask benchtop" action={<Icon name="sparkles" color="var(--tang-500)" />}>
          <p style={{ margin: 0, fontSize: 15 }}>Bars are coming out crumbly. Want to firm the bite without more sugar?</p>
          <div style={{ marginTop: 12, padding: 12, background: "var(--paper-200)", borderRadius: 8, fontSize: 14 }}><b>Try this:</b> swap 4% glucose syrup for allulose. Predicted aw <span className="mono">0.58</span>, sugars <span className="mono">−4.0 g</span>, binding holds.</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button size="sm" onClick={apply} disabled={applied}>{applied ? "Applied" : "Apply to v5"}</Button><Button size="sm" variant="ghost">Explain why</Button></div>
        </Card>
        <Switch label="AI suggestions" defaultChecked />
      </div></div></div>;
}
function Trials() {
  const t = [["T-014","c","firm, slight chew","ok","pass","0.62"],["T-013","b","crumbly","danger","fail","0.66"],["T-012","b","too sweet","warn","review","0.64"],["T-011","a","baseline","neutral","draft","0.69"]];
  return <div><PageHead sub="OAB-v4" title="Trials" actions={<Button icon="plus">Log trial</Button>} />
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 20 }}>
      <Card padding={0}>{t.map(([id, r, note, tone, st, aw], i) => <div key={id} style={{ display: "grid", gridTemplateColumns: "90px 60px 1fr 90px 70px", gap: 12, padding: "14px 20px", borderBottom: i < 3 ? "1px solid var(--ink-200)" : 0, alignItems: "center" }}><b className="mono">{id}</b><span className="mono" style={{ color: "var(--fg-3)" }}>rev {r}</span><span>{note}</span><Badge tone={tone} dot>{st}</Badge><span className="mono" style={{ textAlign: "right" }}>aw {aw}</span></div>)}</Card>
      <Input label="Search trials" placeholder="texture, batch…" /></div></div>;
}
function Assistant() {
  return <div style={{ maxWidth: 640 }}><PageHead sub="Assistant" title="Ask benchtop" />
    <Card tone="lcd" padding={24}><div className="display" style={{ fontSize: 32 }}>What are we solving today?</div><div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>{["Reduce sugar 30%", "Fix crumbly texture", "Replace palm oil", "Extend shelf life"].map(s => <Button key={s} size="sm" variant="primary">{s}</Button>)}</div></Card>
    <div style={{ marginTop: 16 }}><Input label="Describe the challenge" placeholder="e.g. gummy is weeping after 3 weeks at 25°C" /></div></div>;
}
Object.assign(window, { FormulationList, Editor, Trials, Assistant });