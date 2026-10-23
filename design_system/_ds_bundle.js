/* @ds-bundle: {"format":4,"namespace":"DesignSystem_998768","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"},{"name":"SegmentDisplay","sourcePath":"components/core/SegmentDisplay.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"1f6dc0e4450d","components/core/Button.jsx":"ef36919f4c47","components/core/Card.jsx":"74b6025df09b","components/core/Icon.jsx":"edd79cee021a","components/core/Logo.jsx":"0d10d7bbf880","components/core/SegmentDisplay.jsx":"4d01af8575a0","components/feedback/Tooltip.jsx":"817ffc6d2222","components/forms/Checkbox.jsx":"7fb7540e916f","components/forms/Input.jsx":"95023c520728","components/forms/Switch.jsx":"a9f15319c835","components/navigation/Tabs.jsx":"3d1e8015cf48","ui_kits/app/Screens.jsx":"e919f81cae61","ui_kits/app/Shell.jsx":"62630f766ecd"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_998768 = window.DesignSystem_998768 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function Badge({
  tone = "neutral",
  dot = false,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "bt-badge bt-badge--" + tone
  }, dot && /*#__PURE__*/React.createElement("i", {
    className: "bt-badge__d"
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  tone = "paper",
  title,
  action,
  padding = 20,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "bt-card" + (tone !== "paper" ? " bt-card--" + tone : ""),
    style: style
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "bt-card__h"
  }, /*#__PURE__*/React.createElement("span", null, title), action), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
const cache = {};
function Icon({
  name,
  size = 20,
  color = "currentColor",
  style
}) {
  const [svg, setSvg] = React.useState(cache[name] || "");
  React.useEffect(() => {
    if (cache[name]) {
      setSvg(cache[name]);
      return;
    }
    let ok = true;
    fetch("https://unpkg.com/lucide-static@0.468.0/icons/" + name + ".svg").then(r => r.text()).then(t => {
      cache[name] = t.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"');
      if (ok) setSvg(cache[name]);
    }).catch(() => {});
    return () => {
      ok = false;
    };
  }, [name]);
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      flex: "none",
      color,
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: svg
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = "primary",
  size = "md",
  icon,
  iconOnly = false,
  children,
  className = "",
  ...rest
}) {
  const cls = ["bt-btn", "bt-btn--" + variant, size !== "md" && "bt-btn--" + size, iconOnly && "bt-btn--icon", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === "lg" ? 22 : 18
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
function Logo({
  variant = "mark",
  height = 48,
  color = "var(--ink-900)",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-label": "benchtop",
    style: {
      display: "inline-block",
      fontFamily: "var(--font-segment)",
      fontWeight: 700,
      fontSize: height * 1.7,
      lineHeight: height * 1.1 + "px",
      height: height * 1.1,
      letterSpacing: "0.04em",
      color,
      whiteSpace: "nowrap",
      ...style
    }
  }, variant === "mark" ? "B" : "BENCHTOP");
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentDisplay.jsx
try { (() => {
function SegmentDisplay({
  value = "0",
  height = 48,
  color = "var(--ink-900)",
  ghost = true
}) {
  const fs = height * 1.7;
  return /*#__PURE__*/React.createElement("span", {
    role: "img",
    "aria-label": String(value),
    style: {
      display: "inline-flex",
      fontFamily: "var(--font-segment)",
      fontWeight: 700,
      fontSize: fs,
      lineHeight: height * 1.1 + "px",
      height: height * 1.1,
      letterSpacing: "0.04em",
      color
    }
  }, String(value).split("").map((ch, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: "inline-grid"
    }
  }, ghost && ch !== "." && ch !== " " && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      gridArea: "1/1",
      opacity: 0.08
    }
  }, "8"), /*#__PURE__*/React.createElement("span", {
    style: {
      gridArea: "1/1"
    }
  }, ch))));
}
Object.assign(__ds_scope, { SegmentDisplay });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentDisplay.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  forceShow = false,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "bt-tip" + (forceShow ? " bt-tip--show" : "")
  }, children, /*#__PURE__*/React.createElement("span", {
    className: "bt-tip__b",
    role: "tooltip"
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  label,
  disabled,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "bt-chk" + (disabled ? " bt-chk--off" : "")
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "bt-chk__b"
  }), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  hint,
  error,
  mono = false,
  unit,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "bt-in" + (mono ? " bt-in--mono" : "") + (error ? " bt-in--err" : "")
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "bt-in__l"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "bt-in__f"
  }, /*#__PURE__*/React.createElement("input", rest), unit && /*#__PURE__*/React.createElement("span", {
    className: "bt-in__u"
  }, unit)), (error || hint) && /*#__PURE__*/React.createElement("span", {
    className: "bt-in__h"
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  label,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "bt-sw"
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch"
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "bt-sw__t"
  }), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "bt-tabs",
    role: "tablist"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    role: "tab",
    "aria-selected": it.id === value,
    className: "bt-tab",
    onClick: () => onChange && onChange(it.id)
  }, it.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Screens.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Input,
  Tabs,
  Switch,
  SegmentDisplay,
  Icon,
  Tooltip
} = window.DesignSystem_998768;
const forms = [["Oat & Almond Bar", "OAB-v4", "Bars", "ok", "stable", "aw 0.62", "12.4"], ["Probiotic Gummy", "PGM-v2", "Confection", "warn", "review", "aw 0.55", "31.0"], ["Plant Cheese Slice", "PCS-v7", "Dairy-alt", "neutral", "draft", "aw 0.97", "1.2"], ["Protein Crisps", "PRC-v1", "Snacks", "danger", "fail", "aw 0.38", "4.8"]];
function FormulationList({
  open
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    sub: "Snack R&D bench",
    title: "Formulations",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "filter"
    }, "Filter"), /*#__PURE__*/React.createElement(Button, {
      icon: "plus"
    }, "New formulation"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
      gap: 20
    }
  }, forms.map(([n, id, cat, tone, st, aw, sug]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    onClick: () => open(id),
    style: {
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: n,
    action: /*#__PURE__*/React.createElement(Badge, {
      tone: tone,
      dot: true
    }, st)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, "Sugars g/100g"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(SegmentDisplay, {
    value: sug,
    height: 40
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      font: "400 13px/1.7 var(--font-mono)",
      color: "var(--fg-2)"
    }
  }, id, /*#__PURE__*/React.createElement("br", null), cat, " \xB7 ", aw)))))));
}
const rows0 = [["Rolled oats", 38.0], ["Almond butter", 16.5], ["Glucose syrup", 14.0], ["Sucrose", 12.4], ["Pea protein", 10.0], ["Sea salt", 0.6], ["Natural flavour", 0.5]];
function Editor() {
  const [tab, setTab] = React.useState("f");
  const [rows, setRows] = React.useState(rows0);
  const [applied, setApplied] = React.useState(false);
  const total = rows.reduce((a, r) => a + r[1], 0);
  const apply = () => {
    setApplied(true);
    setRows(r => r.map(x => x[0] === "Glucose syrup" ? [x[0], 10.0] : x[0] === "Allulose" ? x : x).concat([["Allulose", 4.0]]));
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    sub: "OAB-v4 \xB7 rev c",
    title: "Oat & Almond Bar",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "git-compare"
    }, "Compare"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: "play"
    }, "Run trial"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)",
      gap: 20,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      id: "f",
      label: "Formula"
    }, {
      id: "t",
      label: "Trials"
    }, {
      id: "s",
      label: "Specs"
    }]
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 0
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 120px",
      padding: "12px 20px",
      borderBottom: "1.5px solid var(--ink-900)"
    },
    className: "label"
  }, /*#__PURE__*/React.createElement("span", null, "Ingredient"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "% w/w")), rows.map(([n, q], i) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 120px",
      padding: "10px 20px",
      borderBottom: "1px solid var(--ink-200)",
      alignItems: "center",
      background: n === "Allulose" ? "var(--lcd-100)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, n, n === "Allulose" && /*#__PURE__*/React.createElement(Badge, {
    tone: "warm"
  }, "AI")), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      textAlign: "right",
      fontSize: 16
    }
  }, q.toFixed(1)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 120px",
      padding: "14px 20px",
      background: "var(--ink-900)",
      color: "var(--lcd-300)"
    }
  }, /*#__PURE__*/React.createElement("b", null, "Total"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      textAlign: "right",
      fontSize: 16
    }
  }, total.toFixed(1))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tone: "lcd"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 20,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      color: "var(--ink-800)",
      whiteSpace: "nowrap"
    }
  }, "Water act."), /*#__PURE__*/React.createElement(SegmentDisplay, {
    value: applied ? "0.58" : "0.62",
    height: 34
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      color: "var(--ink-800)",
      whiteSpace: "nowrap"
    }
  }, "Sugars"), /*#__PURE__*/React.createElement(SegmentDisplay, {
    value: applied ? "8.4" : "12.4",
    height: 34
  })))), /*#__PURE__*/React.createElement(Card, {
    title: "Ask benchtop",
    action: /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      color: "var(--tang-500)"
    })
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15
    }
  }, "Bars are coming out crumbly. Want to firm the bite without more sugar?"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: 12,
      background: "var(--paper-200)",
      borderRadius: 8,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("b", null, "Try this:"), " swap 4% glucose syrup for allulose. Predicted aw ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "0.58"), ", sugars ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "\u22124.0 g"), ", binding holds."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: apply,
    disabled: applied
  }, applied ? "Applied" : "Apply to v5"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost"
  }, "Explain why"))), /*#__PURE__*/React.createElement(Switch, {
    label: "AI suggestions",
    defaultChecked: true
  }))));
}
function Trials() {
  const t = [["T-014", "c", "firm, slight chew", "ok", "pass", "0.62"], ["T-013", "b", "crumbly", "danger", "fail", "0.66"], ["T-012", "b", "too sweet", "warn", "review", "0.64"], ["T-011", "a", "baseline", "neutral", "draft", "0.69"]];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHead, {
    sub: "OAB-v4",
    title: "Trials",
    actions: /*#__PURE__*/React.createElement(Button, {
      icon: "plus"
    }, "Log trial")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) 280px",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 0
  }, t.map(([id, r, note, tone, st, aw], i) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "grid",
      gridTemplateColumns: "90px 60px 1fr 90px 70px",
      gap: 12,
      padding: "14px 20px",
      borderBottom: i < 3 ? "1px solid var(--ink-200)" : 0,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("b", {
    className: "mono"
  }, id), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--fg-3)"
    }
  }, "rev ", r), /*#__PURE__*/React.createElement("span", null, note), /*#__PURE__*/React.createElement(Badge, {
    tone: tone,
    dot: true
  }, st), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      textAlign: "right"
    }
  }, "aw ", aw)))), /*#__PURE__*/React.createElement(Input, {
    label: "Search trials",
    placeholder: "texture, batch\u2026"
  })));
}
function Assistant() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    sub: "Assistant",
    title: "Ask benchtop"
  }), /*#__PURE__*/React.createElement(Card, {
    tone: "lcd",
    padding: 24
  }, /*#__PURE__*/React.createElement("div", {
    className: "display",
    style: {
      fontSize: 32
    }
  }, "What are we solving today?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16,
      flexWrap: "wrap"
    }
  }, ["Reduce sugar 30%", "Fix crumbly texture", "Replace palm oil", "Extend shelf life"].map(s => /*#__PURE__*/React.createElement(Button, {
    key: s,
    size: "sm",
    variant: "primary"
  }, s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Describe the challenge",
    placeholder: "e.g. gummy is weeping after 3 weeks at 25\xB0C"
  })));
}
Object.assign(window, {
  FormulationList,
  Editor,
  Trials,
  Assistant
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Shell.jsx
try { (() => {
const {
  Logo,
  Icon,
  Badge,
  Button
} = window.DesignSystem_998768;
const nav = [["formulations", "flask-conical", "Formulations"], ["trials", "test-tubes", "Trials"], ["ingredients", "wheat", "Ingredients"], ["assistant", "sparkles", "Ask benchtop"]];
function Sidebar({
  screen,
  go
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 232,
      background: "var(--ink-900)",
      color: "var(--ink-300)",
      padding: "20px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 10px 22px"
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "wordmark",
    height: 30,
    color: "var(--lcd-300)"
  })), nav.map(([id, ic, label]) => {
    const on = screen === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => go(id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 40,
        padding: "0 12px",
        border: 0,
        borderRadius: 8,
        cursor: "pointer",
        font: "500 15px var(--font-body)",
        background: on ? "var(--lcd-300)" : "transparent",
        color: on ? "var(--ink-900)" : "inherit",
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 18
    }), label);
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      padding: 12,
      border: "1px solid var(--ink-700)",
      borderRadius: 10,
      font: "400 12px/1.5 var(--font-mono)"
    }
  }, "bench: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--lcd-300)"
    }
  }, "Snack R&D"), /*#__PURE__*/React.createElement("br", null), "3 trials running"));
}
function PageHead({
  title,
  sub,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, sub), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 40,
      marginTop: 6
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, actions));
}
Object.assign(window, {
  Sidebar,
  PageHead
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.SegmentDisplay = __ds_scope.SegmentDisplay;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
