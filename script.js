(function() {
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

// Firebase ကို တစ်ခါပဲ Init လုပ်ရန်
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// --- Configuration ---
const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com"; 
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";

function getDisplayNameWithBadge(d) {
    // 1. ဒေတာမရှိရင် ချက်ချင်း Return ပြန်ခြင်း (Early Exit)
    if (!d) return "Anonymous";

    // 2. Security: XSS Attack မှ ကာကွယ်ရန် နာမည်ကို Sanitize လုပ်ခြင်း
    const rawName = d.author || d.displayName || "User";
    const safeName = rawName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let badge = "";
    // 3. Logic: Crown (Official) ကို Priority ပေးထားခြင်း
    if (d.isCrown === true) {
        badge = ` <span class="badge-official crown-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap; border-radius:4px; background:#FFD700; color:#000;">👑 Official</span>`;
    } else if (d.isGold === true) {
        badge = ` <span class="badge-official gold-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap; border-radius:4px; background:#DAA520; color:#fff;">$ Verified</span>`;
    }

    // 4. UI: Flexbox သုံးပြီး နာမည်နှင့် Badge ကို အလယ်တည့်တည့် ညှိခြင်း
    return `<span style="display:inline-flex; align-items:center; gap:4px; font-weight:500;">${safeName}${badge}</span>`;
}

/**
 * Device ID ကို FingerprintJS သုံးပြီး ယူသော Function
 * Performance အတွက် Agent ကို Cache လုပ်ထားပါမည်
 */
let fpAgent = null; // Memory ထဲမှာ သိမ်းထားရန်

async function getMyDeviceId() {
    try {
        // 1. Library စစ်ဆေးခြင်း
        if (typeof FingerprintJS === 'undefined') {
            console.error("FingerprintJS library not found. Please include the script.");
            return "unknown_device_id";
        }

        // 2. Performance Logic: Agent ကို တစ်ခါပဲ Load လုပ်ရန်
        if (!fpAgent) {
            fpAgent = await FingerprintJS.load();
        }

        // 3. Device ID ထုတ်ယူခြင်း
        const result = await fpAgent.get();
        return result.visitorId;

    } catch (e) {
        console.error("Critical Fingerprint Error:", e);
        // Error ဖြစ်ခဲ့ရင်တောင် Application မရပ်သွားအောင် Default တစ်ခုပြန်ပေးခြင်း
        return "error_generating_id";
    }
}
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;

        if (entry.intersectionRatio < 0.8) {
            // မြင်ကွင်းရဲ့ ၈၀% အောက်ရောက်ရင် ဗီဒီယိုကို ခေတ္တရပ်မယ် (Pause)
            video.pause();
        } else {
            // မြင်ကွင်းထဲ ရောက်နေချိန်မှာ နှိပ်လိုက်မှ Play/Pause လုပ်မည့် Event Listener ထည့်ခြင်း
            // တစ်ခါပဲ ထည့်မိအောင် check လုပ်ထားပါတယ်
            if (!video.dataset.hasListener) {
                video.addEventListener('click', () => {
                    if (video.paused) {
                        video.play().catch(e => console.error("Play error:", e));
                    } else {
                        video.pause();
                    }
                });
                video.dataset.hasListener = "true"; // Listener နှစ်ခါမထပ်အောင် မှတ်ထားခြင်း
                video.style.cursor = "pointer"; // User နှိပ်လို့ရမှန်းသိအောင် Mouse pointer ပြောင်းခြင်း
            }
        }
    });
}, { threshold: [0.8] });

function observeElements() {
    document.querySelectorAll('video').forEach(v => videoObserver.observe(v));
    document.querySelectorAll('.post-card').forEach(post => scrollObserver.observe(post));
}
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const adminEmail = "uwinkyawdevelopbusinessco@gmail.com";
            
            // ၁။ Device ID ရယူခြင်း
            const currentDevId = await Promise.race([
                getMyDeviceId(),
                new Promise(resolve => setTimeout(() => resolve("timeout_id"), 5000))
            ]);

            const userRef = db.collection("users").doc(user.uid);
            const doc = await userRef.get();

            // ၂။ Device Lock Logic (Admin အတွက် ခြွင်းချက်ထားခြင်း)
            if (doc.exists && user.email !== adminEmail) {
                const existingData = doc.data();
                if (currentDevId !== "timeout_id" && existingData.deviceId && existingData.deviceId !== currentDevId) {
                    alert("Account Error: Device Lock အလုပ်လုပ်နေပါသည်။");
                    await auth.signOut();
                    return;
                }
            }

            // ၃။ Data Update (Admin ဆိုလျှင်လည်း နောက်ဆုံးဝင်တဲ့ Device ID ကိုတော့ မှတ်ထားပေးမည်)
            const updatePayload = {
                uid: user.uid,
                displayName: user.displayName || "User",
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (currentDevId !== "timeout_id") {
                updatePayload.deviceId = currentDevId;
            }

            await userRef.set(updatePayload, { merge: true });

            // UI ပိုင်းပြသခြင်း... (ယခင် logic အတိုင်း)
            // ... (ကျန်တဲ့ AutoFriend နဲ့ UI Update ကုဒ်များ) ...

        } catch (e) {
            console.error("Auth Logic Error:", e);
        }
    }
});
// renderPostHTML function ထဲက media အပိုင်းကို ဒါလေးနဲ့ အစားထိုးပါ
let media = "";
if (d.mediaUrls && d.mediaUrls.length > 0) {
    if (d.mediaType === 'video') {
        // Video ပြတဲ့ logic (နဂိုအတိုင်း)
        media = `<div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                    <video src="${d.mediaUrls[0]}" onplay="incrementView('${id}')" preload="metadata" playsinline style="width:100%; display:block;"></video>
                 </div>`;
    } else {
        // Image အများကြီးကို loop ပတ်ပြီး ပြမည့် logic
        media = `<div style="display: grid; grid-template-columns: ${d.mediaUrls.length > 1 ? 'repeat(2, 1fr)' : '1fr'}; gap: 5px; margin-top: 10px;">`;
        d.mediaUrls.forEach(url => {
            media += `<img src="${url}" style="width:100%; height:200px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="incrementView('${id}')">`;
        });
        media += `</div>`;
    }
}
async function uploadAndPost() {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const fileInput = document.getElementById('mediaInput');
    const files = Array.from(fileInput.files); // FileList ကို Array ပြောင်းခြင်း
    const text = document.getElementById('postContent').value.trim();
    const btn = document.getElementById('btnPost');

    try {
        // ၁။ User Role အရ Limit များ သတ်မှတ်ခြင်း
        const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        const isPremium = userData.isCrown === true || userData.isGold === true;

        const maxFiles = isPremium ? 10 : 1;
        const maxVideoSize = isPremium ? 60 * 1024 * 1024 : 20 * 1024 * 1024;

        if (files.length > maxFiles) return alert(`သင့်အဆင့်အတန်းအရ တစ်ခါတင်ရင် ${maxFiles} ဖိုင်သာ ခွင့်ပြုပါတယ်!`);
        if (!text && files.length === 0) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ");

        btn.disabled = true;
        btn.innerText = "တင်နေသည်...";

        let mediaUrls = []; // ပုံ/ဗီဒီယို URL အားလုံး သိမ်းရန် Array
        let mediaType = "";

        // ၂။ ဖိုင်များကို Loop ပတ်၍ စစ်ဆေးခြင်းနှင့် တင်ခြင်း
        for (let file of files) {
            const isVideo = file.type.startsWith('video/');
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            if (isVideo) {
                if (file.size > maxVideoSize) throw new Error(`ဗီဒီယိုဆိုဒ် ${isPremium ? '60MB' : '20MB'} ထက် ကျော်နေပါတယ်`);
                mediaType = 'video';
                
                // Bunny.net Upload
                const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { 
                    method: 'PUT', headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: file
                });
                if (res.ok) mediaUrls.push(`https://public-hospitals.b-cdn.net/${fileName}`);
                
                // ဗီဒီယိုဆိုရင် တစ်ခုပဲ တင်ခိုင်းချင်လို့ loop ကို ရပ်မယ် (Optional)
                if (files.length > 1 && isVideo) break; 

            } else {
                mediaType = 'image';
                // ImgBB Upload
                const fd = new FormData();
                fd.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) mediaUrls.push(data.data.url);
            }
        }

        // ၃။ Firestore ထဲသို့ သိမ်းဆည်းခြင်း (mediaUrl နေရာမှာ Array သုံးလိုက်သည်)
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            uid: auth.currentUser.uid,
            text: text,
            mediaUrls: mediaUrls, // Array အနေနဲ့ သိမ်းမယ်
            mediaType: mediaType,
            isCrown: userData.isCrown || false,
            isGold: userData.isGold || false,
            likes: 0, views: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ၄။ UI Reset
        document.getElementById('postContent').value = "";
        fileInput.value = "";
        if(document.getElementById('mediaPreviewBox')) document.getElementById('mediaPreviewBox').style.display = 'none';
        alert("တင်ပြီးပါပြီ Senior!");

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "တင်မည်";
    }
}

function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "ခုနကတင်";
    if (diff < 3600) return Math.floor(diff / 60) + " မိနစ်ခန့်က";
    if (diff < 86400) return Math.floor(diff / 3600) + " နာရီခန့်က";
    if (diff < 172800) return "မနေ့က";
    
    // ၂ ရက်ထက်ကျော်ရင် ရက်စွဲအတိုင်းပြမယ်
    return date.toLocaleDateString('my-MM', { day: 'numeric', month: 'short', year: 'numeric' });
}
function renderPostHTML(id, d, uid, isAdmin) {
    // ၁။ Like/Haha နှင့် အချိန် Logic (နဂိုအတိုင်း)
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const timeDisplay = formatTime(d.createdAt);

    // ၂။ Media Logic - Senior Video Tag နှင့် နဂို Logic ပေါင်းစပ်ခြင်း
    let media = "";
    if (d.mediaUrl) {
        if (d.mediaType === 'video' || d.mediaUrl.toLowerCase().includes('.mp4')) {
            let finalVideoUrl = d.mediaUrl;
            
            // Bunny.net URL path အမှန်ပြင်ခြင်း logic ကို ဆက်ထိန်းထားသည်
            if (finalVideoUrl.includes('b-cdn.net') && !finalVideoUrl.includes('b-cdn.net/public-hospitals/')) {
                finalVideoUrl = finalVideoUrl.replace('b-cdn.net/', 'b-cdn.net/public-hospitals/');
            }

            // Senior အကြံပြုထားသော Video Tag (နဂို incrementView logic ကိုပါ ထည့်သွင်းထားသည်)
            media = `
                <div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                    <video 
                        src="${finalVideoUrl}"
                        onplay="incrementView('${id}')" 
                        preload="metadata" 
                        playsinline 
                        webkit-playsinline
                        style="width: 100%; display: block; border-radius: 8px; cursor: pointer;">
                    </video>
                </div>`;
        } else {
            media = `<img onclick="incrementView('${id}')" src="${d.mediaUrl}" style="width:100%; border-radius:8px; margin-top:10px; display:block; cursor:pointer;">`;
        }
    }

    // ၃။ UI Layout (နဂိုအတိုင်း မပျက်စေဘဲ ပြန်ထုတ်ပေးခြင်း)
    return `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                <b style="color: purple; font-size: 15px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                    ${getDisplayNameWithBadge(d)}
                </b>
                <small style="color: gray; font-size: 11px;">${timeDisplay}</small>
            </div>
            
            <div style="display: flex; gap: 10px; flex-shrink: 0; margin-left: 10px;">
                ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned || false})" style="border:none; background:none; cursor:pointer; padding: 0; font-size: 16px;">${d.isPinned ? '📌' : '📍'}</button>` : ''}
                ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer; padding: 0; font-size: 16px;">🗑️</button>` : ''}
            </div>
        </div>

        <p style="margin: 5px 0 10px 0; white-space: pre-wrap; font-size: 14px; text-align: left; color: #333;">${d.text || ""}</p>
        
        ${media}
        
        <div style="display: flex; justify-content: space-between; margin-top: 12px; border-top: 1px solid #eee; padding-top: 10px;">
            <div class="action-bar-content" style="display: flex; gap: 15px;">
                <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}; font-size:14px;">👍 Like (${d.likes||0})</span>
                <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}; font-size:14px;">😆 Haha (${d.hahas||0})</span>
            </div>
            <div class="stat-content" style="font-size: 12px; color: gray;">
                👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares||0})</span>
            </div>
        </div>

        <div style="margin-top: 10px;">
            <div id="comms-${id}">${renderComments(id, d.comments, isAdmin, uid)}</div>
            <div style="display: flex; gap: 5px; margin-top: 10px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius: 15px; border: 1px solid #ddd; padding: 6px 12px; font-size: 13px; outline: none; background: #f9f9f9;">
                <button onclick="addComment('${id}')" style="color: purple; border: none; background: none; font-weight: bold; cursor: pointer;">Send</button>
            </div>
        </div>`;
}
async function handleReact(id, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const ref = db.collection("health_posts").doc(id);
    const snap = await ref.get();
    const d = snap.data();
    const uid = auth.currentUser.uid;
    const field = type==='likes'?'likedBy':'hahaedBy';
    const countField = type==='likes'?'likes':'hahas';

    if (d[field]?.includes(uid)) {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(uid), [countField]: firebase.firestore.FieldValue.increment(-1) });
    } else {
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid), [countField]: firebase.firestore.FieldValue.increment(1) });
    }
}

async function addComment(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const val = document.getElementById(`in-${id}`).value.trim();
    if (!val) return;

    try {
        // --- Badge အတွက် User Status ကို အရင်ယူမယ် ---
        const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const isCrown = userData.isCrown || false;
        const isGold = userData.isGold || false;

        await db.collection("health_posts").doc(id).update({
            comments: firebase.firestore.FieldValue.arrayUnion({
                uid: auth.currentUser.uid, 
                author: auth.currentUser.displayName, 
                isCrown: isCrown, // <--- ထည့်သိမ်းလိုက်ပြီ
                isGold: isGold,   // <--- ထည့်သိမ်းလိုက်ပြီ
                text: val,
                likes:0, likedBy:[], hahas:0, hahaedBy:[], createdAt: Date.now()
            })
        });
        document.getElementById(`in-${id}`).value = "";
    } catch (e) {
        console.error(e);
    }
}
function renderComments(postId, comments, isAdmin, uid) {
    if (!comments || comments.length === 0) return "";

    const sortedComments = [...comments].sort((a, b) => {
        const scoreA = (a.likes || 0) + (a.hahas || 0);
        const scoreB = (b.likes || 0) + (b.hahas || 0);
        return scoreB - scoreA;
    });

    const limit = 5;
    const hasMore = sortedComments.length > limit;
    const displayedComments = sortedComments.slice(0, limit);

    let html = displayedComments.map((c, i) => {
        const isTop = (i === 0 && ((c.likes||0) + (c.hahas||0) > 0));
        // Senior ရဲ့ Comment တိုင်းမှာ Badge စစ်ပေးမယ့်အပိုင်း
        const authorWithBadge = getDisplayNameWithBadge(c); 

        return `
        <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left; border-left:${isTop?'4px solid gold':''}">
            ${isTop ? '<small style="color:#d4af37; font-weight:bold;">🏆 Top Comment</small><br>' : ''}
            <b>${authorWithBadge}</b>: ${c.text} 
            <div style="margin-top:4px; display:flex; gap:10px;">
                <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                ${isAdmin ? `<span onclick="deleteComment('${postId}', ${comments.indexOf(c)})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
            </div>
        </div>`;
    }).join('');

    if (hasMore) {
        html += `<div id="more-btn-${postId}" onclick="showAllComments('${postId}')" style="color:purple; font-size:12px; cursor:pointer; font-weight:bold; margin-top:5px; padding:5px;">
            💬 နောက်ထပ်မှတ်ချက် ${sortedComments.length - limit} ခုကို ဖတ်ရန်...
        </div>
        <div id="extra-comms-${postId}" style="display:none;">
            ${sortedComments.slice(limit).map((c) => `
                <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left;">
                    <b>${getDisplayNameWithBadge(c)}</b>: ${c.text} 
                    <div style="margin-top:4px; display:flex; gap:10px;">
                        <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'likes')" style="cursor:pointer; color:${(c.likedBy||[]).includes(uid)?'blue':'gray'}">👍 ${c.likes||0}</span>
                        <span onclick="reactComment('${postId}', ${comments.indexOf(c)}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy||[]).includes(uid)?'orange':'gray'}">😆 ${c.hahas||0}</span>
                                       ${isAdmin ? `<span onclick="deleteComment('${postId}', ${comments.indexOf(c)})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
                    </div>
                </div>`).join('')}
        </div>`;
    }
    return html;
}


async function reactComment(postId, index, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = [...snap.data().comments];
    let c = comments[index];
    const uid = auth.currentUser.uid;
    const f = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const cf = type === 'likes' ? 'likes' : 'hahas';

    if (!c[f]) c[f] = [];
    
    let isAddingReaction = false; // Notification ပို့သင့်မပို့သင့် စစ်ရန်

    if (c[f].includes(uid)) {
        // Reaction ကို ပြန်ဖြုတ်တာ (Unlike / Un-haha)
        c[f] = c[f].filter(x => x !== uid);
        c[cf] = Math.max(0, (c[cf] || 0) - 1);
    } else {
        // Reaction အသစ်ပေးတာ
        c[f].push(uid);
        c[cf] = (c[cf] || 0) + 1;
        isAddingReaction = true; 
    }

    // Database Update လုပ်မယ်
    await ref.update({ comments });

    // --- Auto Notification Logic ---
    // Reaction ပေးတာဖြစ်ရမယ်၊ ကိုယ့် Comment ကိုယ်ပေးတာ မဟုတ်ရဘူး၊ ပြီးတော့ တစ်ဖက်လူ UID ရှိရမယ်
    if (isAddingReaction && c.uid !== uid) {
        const reactionName = type === 'likes' ? "Like ❤️" : "Haha 😂";
        
        await db.collection("notifications").add({
            receiverId: c.uid, // Comment ပိုင်ရှင်ရဲ့ UID
            senderId: uid,
            title: "Reaction အသစ်ရှိပါသည်",
            body: `${auth.currentUser.displayName || "User"} က သင်၏ Comment ကို ${reactionName} ပေးလိုက်ပါတယ်`,
            status: "unread",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

async function deleteComment(postId, index) {
    if(!confirm("ဤမှတ်ချက်ကို ဖျက်မလား Senior?")) return;
    const ref = db.collection("health_posts").doc(postId);
    const snap = await ref.get();
    let comments = [...snap.data().comments];
    comments.splice(index, 1);
    await ref.update({ comments });
}

async function togglePin(id, current) { await db.collection("health_posts").doc(id).update({ isPinned: !current }); }
async function deletePost(id) { if(confirm("ဖျက်မှာလား Senior?")) await db.collection("health_posts").doc(id).delete(); }
async function incrementView(id) { db.collection("health_posts").doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }); }
async function handleShare(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    try {
        const ref = db.collection("health_posts").doc(id);
        const snap = await ref.get();
        const d = snap.data();

        // ၁။ မူရင်း Post ရဲ့ Share Count ကို +1 တိုးမယ်
        await ref.update({ shares: firebase.firestore.FieldValue.increment(1) });

        // ၂။ Post အသစ်တစ်ခုအနေနဲ့ Feed ထဲကို ထပ်ထည့်မယ် (ဒါမှ သူများတွေ မြင်ရမှာပါ)
        await db.collection("health_posts").add({
            ...d, // မူရင်းစာနဲ့ ပုံတွေကို ယူမယ်
            author: `${auth.currentUser.displayName} (Shared)`, // Share တဲ့လူအမည်ပြမယ်
            uid: "shared_post", 
            likes: 0, likedBy: [], 
            hahas: 0, hahaedBy: [], 
            comments: [], 
            shares: 0,
            views: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Shared to News Feed!");
    } catch (e) {
        alert("Share လုပ်လို့မရပါဘူး Senior: " + e.message);
    }
}
function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    const file = input.files[0];
    if (file) {
        box.style.display = 'block';
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            box.innerHTML = `<video src="${url}" style="width:100%; border-radius:8px;" muted autoplay loop></video>`;
        } else {
            box.innerHTML = `<img src="${url}" style="width:100%; border-radius:8px;">`;
        }
    }
}
// --- Global Functions ---
function isSafeName(name) {
    if (!name) return false;
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    return safePattern.test(name);
}
// --- ၁။ နာမည်သိမ်းသည့် Function (ပေါင်းစည်းပြီးသား) ---
async function saveInitialName() {
    const nameElement = document.getElementById('setupUserName');
    if(!nameElement) return;

    const inputName = nameElement.value.trim();

    // စစ်ဆေးမှုများ (Validation Layers)
    if(inputName.length < 2) {
        return alert("အမည်အမှန်ရိုက်ပါ (အနည်းဆုံး ၂ လုံး)");
    }

    if (!isSafeName(inputName)) {
        return alert("Senior ရေ... နာမည်မှာ Emoji နဲ့ Special Character တွေ မသုံးပါနဲ့ဗျာ။ စာသားနဲ့ ဂဏန်းပဲ သုံးပေးပါ။");
    }

    try {
        // Firebase Auth Update
        await auth.currentUser.updateProfile({ 
            displayName: inputName 
        });

        // Firestore Database Update (Sync လုပ်ခြင်း)
        await db.collection("users").doc(auth.currentUser.uid).set({
            displayName: inputName,
            // နာမည်ပြင်ပြီးသားဖြစ်ကြောင်း Flag တစ်ခုပါ ထည့်ထားလို့ရတယ် Senior
            isProfileSetup: true 
        }, { merge: true });

        console.log("Success: Name updated to " + inputName);
        location.reload(); // ပြောင်းလဲမှုတွေ မြင်ရအောင် Reload လုပ်မယ်
        
    } catch (error) {
        console.error("Error saving name: ", error);
        alert("သိမ်းလို့မရဖြစ်နေပါတယ် Senior။ ခဏနေမှ ပြန်လုပ်ကြည့်ပါ။");
    }
}

// --- ၂။ Emoji စစ်ဆေးသည့် Function (Helper) ---
function isSafeName(name) {
    if (!name) return false;
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    return safePattern.test(name);
}

// --- ၃။ Comment အကုန်ပြသည့် Function ---
function showAllComments(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    if (extra && btn) {
        extra.style.display = 'block';
        btn.style.display = 'none';
    }
}

// ကိုယ့်ဆီရောက်လာတဲ့ Notification တွေကို အမြဲစောင့်ကြည့်မယ်
function startLiveNotifications() {
    const myUid = auth.currentUser.uid;
    db.collection("notifications")
      .where("receiverId", "==", myUid)
      .where("status", "==", "unread")
      .onSnapshot(snap => {
          snap.docChanges().forEach(change => {
              if (change.type === "added") {
                  const d = change.doc.data();
                  // Notification ပြမယ်
                  new Notification(d.title, { body: d.body });
                  // ပြပြီးရင် read လုပ်မယ်
                  db.collection("notifications").doc(change.doc.id).update({ status: "read" });
              }
          });
      });
}
async function startAutoFriendSystem(myUid) {
    try {
        const myRef = db.collection("users").doc(myUid);
        const myDoc = await myRef.get();
        const myData = myDoc.data();

        // ၁။ ဒီ User ကို Auto Friend လုပ်ပေးပြီးသားလား အရင်စစ်မယ်
        if (myData.isAutoFriendAdded === true) {
            console.log("Auto friends already processed for this user.");
            return; // ပြီးသားဆိုရင် ဆက်မလုပ်တော့ဘူး (Database Load မတက်တော့ဘူး)
        }

        const limit = 50; // Senior ရေ... လူ ၃၀၀၀ ကို တစ်ခါတည်းထည့်ရင် Error တက်နိုင်လို့ ၅၀ စီပဲ အရင်စစ်ကြည့်ပါ
        let currentCount = 0;

        // ၂။ Database ထဲက အခြား User တွေကို ဆွဲထုတ်မယ်
        const usersSnap = await db.collection("users")
            .where("uid", "!=", myUid)
            .limit(limit) 
            .get();

        // ၃။ Batch Write သုံးပါမယ် (ဒါက Database speed ပိုမြန်ပြီး ပိုက်ဆံပိုသက်သာပါတယ်)
        const batch = db.batch();

        usersSnap.forEach(doc => {
            const otherUser = doc.data();
            
            // ကိုယ့်ဆီမှာ သူ့ကို Friend အဖြစ်ထည့်
            const myFriendRef = myRef.collection("friends").doc(otherUser.uid);
            batch.set(myFriendRef, {
                uid: otherUser.uid,
                displayName: otherUser.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // သူ့ဆီမှာ ကိုယ့်ကို Friend အဖြစ်ပြန်ထည့်
            const otherFriendRef = db.collection("users").doc(otherUser.uid).collection("friends").doc(myUid);
            batch.set(otherFriendRef, {
                uid: myUid,
                displayName: myData.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentCount++;
        });

        // ၄။ အားလုံးပြီးမှ Flag ကို True ပေးလိုက်မယ် (နောက်တစ်ခါ ဝင်ရင် ဒီ Function အလုပ်မလုပ်တော့ဘူး)
        batch.update(myRef, { 
            isAutoFriendAdded: true,
            friendCount: firebase.firestore.FieldValue.increment(currentCount)
        });

        await batch.commit();
        console.log(`Successfully added ${currentCount} auto friends.`);

    } catch (e) {
        console.error("AutoFriend Error:", e);
    }
}


async function checkBanStatus(userId, deviceId) {
    // ၁။ Device ID နဲ့ စစ်မယ်
    const deviceSnap = await db.collection("banned_devices").doc(deviceId).get();
    
    // ၂။ User UID နဲ့ စစ်မယ်
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();

    if (deviceSnap.exists || (userData && userData.isBanned)) {
        alert("သင့် Device သည် စည်းကမ်းဖောက်ဖျက်မှုကြောင့် အပြီးတိုင် ပိတ်ပင် (Ban) ခံထားရပါသည်။");
        auth.signOut();
        window.location.href = "banned_info.html"; // Ban ခံရကြောင်း ပြမယ့်စာမျက်နှာ
    }
}
// --- Feedback တင်ပေးမည့် Function ---
// --- ၁။ Feedback တင်ပေးမည့် Function ---
async function submitFeedback() {
    const msg = document.getElementById('feedbackMsg').value.trim();
    if (!msg) return alert("စာသားလေး တစ်ခုခု ရေးပေးပါဦး Senior");

    try {
        const user = auth.currentUser;
        if (!user) return alert("Login အရင်ဝင်ပါ");

        // Device အချက်အလက်ယူခြင်း
        const deviceInfo = navigator.userAgent.split(')')[0].split('(')[1] || "Unknown Device";

        await db.collection("feedbacks").add({
            uid: user.uid,
            userName: user.displayName || "အမည်မသိ",
            feedbackMsg: msg,
            device: deviceInfo,
            version: "1.0.0",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ကျေးဇူးတင်ပါတယ် Senior! Feedback ပို့ပြီးပါပြီ။");
        document.getElementById('feedbackMsg').value = ""; 
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// --- ၂။ နာမည်သိမ်းသည့် Function (အစအဆုံး ပြန်ပြင်ထားသည်) ---
async function saveInitialName() {
    try {
        const nameElement = document.getElementById('setupUserName');
        const inputName = nameElement ? nameElement.value.trim() : "";

        if (inputName.length < 2) return alert("အမည်အမှန်ရိုက်ပါ (အနည်းဆုံး ၂ လုံး)");
        if (!isSafeName(inputName)) return alert("စာသားနဲ့ ဂဏန်းပဲ သုံးပေးပါ Senior");

        const user = auth.currentUser;
        if (!user) return alert("User မရှိပါ");

        // Auth Profile Update
        await user.updateProfile({ displayName: inputName });

        // Firestore Sync
        await db.collection("users").doc(user.uid).set({
            displayName: inputName,
            isProfileSetup: true 
        }, { merge: true });

        console.log("Success: Name updated to " + inputName);
        location.reload(); 
        
    } catch (error) {
        console.error("Error saving name: ", error);
        alert("သိမ်းလို့မရဖြစ်နေပါတယ် Senior။");
    }
}

// --- ၃။ Helper & UI Functions ---
function isSafeName(name) {
    if (!name) return false;
    // မြန်မာစာ၊ အင်္ဂလိပ်စာနှင့် ဂဏန်းများသာ ခွင့်ပြုသည်
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    return safePattern.test(name);
}

function showAllComments(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    if (extra && btn) {
        extra.style.display = 'block';
        btn.style.display = 'none';
    }
}

function startLiveNotifications() {
    if (!auth.currentUser) return;

    // Browser Notification Permission တောင်းခြင်း
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    const myUid = auth.currentUser.uid;
    const myIcon = 'https://i.ibb.co/vCywrVgG/Gallery-1772168024425.jpg'; // မင်းရဲ့ Logo Link

    db.collection("notifications")
      .where("receiverId", "==", myUid)
      .where("status", "==", "unread")
      .onSnapshot(snap => {
          snap.docChanges().forEach(change => {
              if (change.type === "added") {
                  const d = change.doc.data();
                  
                  if (Notification.permission === "granted") {
                      new Notification(d.title, { 
                          body: d.body, 
                          icon: myIcon, // Notification Icon
                          badge: myIcon, // Status Bar Icon (Android)
                          vibrate: [200, 100, 200] // ဖုန်းတုန်ခါမှု (Optional)
                      });
                  }

                  // ပြပြီးရင် read လုပ်မယ်
                  db.collection("notifications").doc(change.doc.id).update({ status: "read" });
              }
          });
      });
}
async function startAutoFriendSystem(myUid) {
    try {
        const myRef = db.collection("users").doc(myUid);
        const myDoc = await myRef.get();
        const myData = myDoc.data();

        // ၁။ ဒီ User ကို Auto Friend လုပ်ပေးပြီးသားလား အရင်စစ်မယ်
        if (myData.isAutoFriendAdded === true) {
            console.log("Auto friends already processed for this user.");
            return; // ပြီးသားဆိုရင် ဆက်မလုပ်တော့ဘူး (Database Load မတက်တော့ဘူး)
        }

        const limit = 50;         let currentCount = 0;

        // ၂။ Database ထဲက အခြား User တွေကို ဆွဲထုတ်မယ်
        const usersSnap = await db.collection("users")
            .where("uid", "!=", myUid)
            .limit(limit) 
            .get();

        const batch = db.batch();

        usersSnap.forEach(doc => {
            const otherUser = doc.data();
            
            // ကိုယ့်ဆီမှာ သူ့ကို Friend အဖြစ်ထည့်
            const myFriendRef = myRef.collection("friends").doc(otherUser.uid);
            batch.set(myFriendRef, {
                uid: otherUser.uid,
                displayName: otherUser.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // သူ့ဆီမှာ ကိုယ့်ကို Friend အဖြစ်ပြန်ထည့်
            const otherFriendRef = db.collection("users").doc(otherUser.uid).collection("friends").doc(myUid);
            batch.set(otherFriendRef, {
               uid: myUid,
                displayName: myData.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentCount++;
        });

        batch.update(myRef, { 
            isAutoFriendAdded: true,
            friendCount: firebase.firestore.FieldValue.increment(currentCount)
        });

        await batch.commit();
        console.log(`Successfully added ${currentCount} auto friends.`);

    } catch (e) {
        console.error("AutoFriend Error:", e);
    }
}
async function checkBanStatus(userId, deviceId) {
    // ၁။ Device ID နဲ့ စစ်မယ်
    const deviceSnap = await db.collection("banned_devices").doc(deviceId).get();
    
    // ၂။ User UID နဲ့ စစ်မယ်
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();

    if (deviceSnap.exists || (userData && userData.isBanned)) {
        alert("သင့် Device သည် စည်းကမ်းဖောက်ဖျက်မှုကြောင့် အပြီးတိုင် ပိတ်ပင် (Ban) ခံထားရပါသည်။");
        auth.signOut();
        window.location.href = "banned_info.html"; // Ban ခံရကြောင်း ပြမယ့်စာမျက်နှာ
    }
}
// --- Feedback တင်ပေးမည့် Function ---
async function submitFeedback() {
    const msg = document.getElementById('feedbackMsg').value.trim();
    if (!msg) return alert("စာသားလေး တစ်ခုခု ရေးပေးပါဦး Senior");

    try {
        const user = auth.currentUser;
        // Device အချက်အလက်ယူခြင်း (Admin သိအောင်)
        const deviceInfo = navigator.userAgent.split(')')[0].split('(')[1] || "Unknown Device";

        await db.collection("feedbacks").add({
            uid: user.uid,
            userName: user.displayName || "အမည်မသိ",
            feedbackMsg: msg,
            device: deviceInfo,
            version: "1.0.0", // Senior ရဲ့ App Version
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ကျေးဇူးတင်ပါတယ် Senior! Feedback ကို Admin Panel ဆီ ပို့လိုက်ပါပြီ။");
        document.getElementById('feedbackMsg').value = ""; // စာသားပြန်ဖျက်မယ်
    } catch (e) {
        alert("Error: " + e.message);
    }
}
// Group related functions together
const postActions = {
    uploadAndPost,
    addComment,
    reactComment,
    handleReact,
    handleShare,
    deletePost,
    togglePin,
    previewMedia,
    clearPreview,
    viewFullImage,
    incrementView,
    submitFeedback,
    ADMIN_EMAIL
};

const postLoading = {
    loadPosts,
    loadMorePosts,
    cleanupPosts,
    refreshPosts,
    lastVisiblePost,
    isFetching
};

// Assign to window
Object.assign(window, postActions, postLoading);
})();
