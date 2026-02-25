// badges.js
function getDisplayNameWithBadge(d) {
    if (!d) return "Anonymous";
    let badge = "";
    if (d.isCrown === true) {
        badge = ` <span class="badge-official crown-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap;">👑 Official</span>`;
    } else if (d.isGold === true) {
        badge = ` <span class="badge-official gold-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap;">$ Verified</span>`;
    }
    return `<span style="display:inline-flex; align-items:center; gap:4px;">${d.author || d.displayName || "User"}${badge}</span>`;
}
