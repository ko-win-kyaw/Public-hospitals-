// 1. Firebase Config & Initialization
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com";
const IMGBB_API_KEY = "C8d8d00185e973ebcafddd34f77a1176";
const BUNNY_STORAGE_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_ZONE = "public-hospitals";

let userName = localStorage.getItem("health_user_name") || "Guest";

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        await auth.signInAnonymously();
    } else {
        userName = user.displayName || localStorage.getItem("health_user_name") || "Guest";
        if (user.email === ADMIN_EMAIL) userName = "Admin Developer";
        if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = "အသုံးပြုသူ: " + userName;
        startApp();
        setupRatingSystem();
    }
});

// 2. Stable Feed Logic (Blinking ကို ကာကွယ်ရန်)
function startApp() {
    db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if(!feed) return;
        
        const uid = auth.currentUser ? auth.currentUser.uid : "guest";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            const id = change.doc.id;

            if (change.type === "added") {
                // Post အသစ်တက်လာမှသာ Card အသစ်ဆောက်သည်
                const postCard = createPostElement(id, d, uid, isAdmin);
                if (d.isPinned) feed.prepend(postCard); else feed.appendChild(postCard);
            } 
            if (change.type === "modified") {
                // Reaction ပေးရင် Card တစ်ခုလုံးမဖြုတ်တော့ဘဲ အတွင်းက Data ပဲ Update လုပ်သည်
                updatePostUI(id, d, uid);
            }
            if (change.type === "removed") {
                const el = document.getElementById(`post-${id}`);
                if (el) el.remove();
            }
        });
    });
}

// Card အသစ်ဆောက်သည့် Function
function createPostElement(id, d, uid, isAdmin) {
    const div = document.createElement('div');
    div.id = `post-${id}`;
    div.className = "card";
    div.style = "border:1px solid #ddd; padding:15px; border-radius:12px; margin-bottom:20px; background:#fff; color:#000;";
    
    div.innerHTML = `
        <div class="admin-ui">${isAdmin ? `<span style="color:blue; cursor:pointer;" onclick="togglePin('${id}', ${d.isPinned})">${d.isPinned ? '📍 Unpin' : '📌 Pin'}</span> | <span style="color:red; cursor:pointer;" onclick="deletePost('${id}')">🗑️ Delete</span>` : ''}</div>
        <div style="margin:10px 0;"><b>${d.author}</b> ${d.isPinned ? '📌' : ''}</div>
        <p style="white-space:pre-wrap;">${d.text}</p>
        ${d.imageUrl ? `<img src="${d.imageUrl}" style="width:100%; border-radius:8px; margin:10px 0;">` : ''}
        ${d.videoUrl ? `<video controls preload="metadata" style="width:100%; border-radius:8px; background:#000;"><source src="${d.videoUrl}#t=0.1" type="video/mp4"></video>` : ''}
        
        <div style="display:flex; gap:10px; border-top:1px solid #eee; padding-top:10px; margin-top:10px;">
            <button id="like-btn-${id}" onclick="reactPost('${id}', 'likes')" style="flex:1; border:none; padding:10px; border-radius:8px;">👍 Like (${d.likes||0})</button>
            <button id="haha-btn-${id}" onclick="reactPost('${id}', 'hahas')" style="flex:1; border:none; padding:10px; border-radius:8px;">😆 Haha (${d.hahas||0})</button>
        </div>

        <div style="margin-top:15px; background:#f9f9f9; padding:10px; border-radius:10px;">
            <div id="cmts-${id}">${renderComments(id, d.comments || [], isAdmin, uid)}</div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border-radius:20px; border:1px solid #ddd; padding:8px 15px;">
                <button onclick="addComment('${id}')" style="color:purple; font-weight:bold; border:none; background:none;">Send</button>
            </div>
        </div>
    `;
    return div;
}

// နှိပ်လိုက်တဲ့နေရာလေးတင် Update လုပ်သည့် Function (ဒါကြောင့် မပျောက်တော့ပါ)
function updatePostUI(id, d, uid) {
    const likeBtn = document.getElementById(`like-btn-${id}`);
    const hahaBtn = document.getElementById(`haha-btn-${id}`);
    const cmtDiv = document.getElementById(`cmts-${id}`);
    
    if (likeBtn) {
        likeBtn.innerText = `👍 Like (${d.likes||0})`;
        likeBtn.style.color = (d.likedBy || []).includes(uid) ? "blue" : "black";
    }
    if (hahaBtn) {
        hahaBtn.innerText = `😆 Haha (${d.hahas||0})`;
        hahaBtn.style.color = (d.hahaedBy || []).includes(uid) ? "orange" : "black";
    }
    if (cmtDiv) {
        cmtDiv.innerHTML = renderComments(id, d.comments || [], (auth.currentUser.email === ADMIN_EMAIL), uid);
    }
}

function renderComments(pId, comments, isAdmin, uid) {
    return comments.map(c => `
        <div style="border-bottom:1px solid #eee; padding:5px 0; font-size:14px;">
            <div style="display:flex; justify-content:space-between;"><b>${c.author}</b> ${isAdmin ? `<span style="color:red; cursor:pointer; font-size:10px;" onclick="deleteComment('${pId}','${c.id}')">ဖျက်</span>` : ''}</div>
            <div>${c.text}</div>
            <div style="font-size:11px; margin-top:3px;">
                <span onclick="reactComment('${pId}','${c.id}','likes')" style="cursor:pointer; ${(c.likedBy||[]).includes(uid)?'color:blue;':''}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${pId}','${c.id}','hahas')" style="cursor:pointer; ${(c.hahaedBy||[]).includes(uid)?'color:orange;':''}">😆 ${c.hahas||0}</span>
            </div>
        </div>
    `).join('');
}

// 3. Reactions & Uploads (20MB Limit ပါဝင်သည်)
async function reactPost(id, type) {
    const uid = auth.currentUser.uid;
    const ref = db.collection("health_posts").doc(id);
    const d = (await ref.get()).data();
    const list = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const count = type === 'likes' ? 'likes' : 'hahas';
    
    if ((d[list] || []).includes(uid)) {
        await ref.update({ [list]: firebase.firestore.FieldValue.arrayRemove(uid), [count]: firebase.firestore.FieldValue.increment(-1) });
    } else {
        await ref.update({ [list]: firebase.firestore.FieldValue.arrayUnion(uid), [count]: firebase.firestore.FieldValue.increment(1) });
    }
}

async function uploadAndPost() {
    const text = document.getElementById('postContent').value;
    const imgFile = document.getElementById('imageInput').files[0];
    const vidFile = document.getElementById('videoInput').files[0];
    const btn = document.getElementById('btnPost');

    if(vidFile && vidFile.size > 20 * 1024 * 1024) {
        return alert("ဗီဒီယိုက 20MB ထက်ကြီးနေပါတယ်။");
    }

    btn.disabled = true; btn.innerText = "တင်နေသည်...";
    try {
        let imageUrl = "", videoUrl = "";
        if(imgFile) {
            const fd = new FormData(); fd.append("image", imgFile);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {method:"POST", body:fd});
            imageUrl = (await res.json()).data.url;
        }
        if(vidFile) {
            const fileName = Date.now() + "_" + vidFile.name.replace(/\s+/g, '_');
            const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_ZONE}/${fileName}`, {
                method: "PUT",
                headers: { "AccessKey": BUNNY_STORAGE_KEY, "Content-Type": "application/octet-stream" },
                body: vidFile
            });
            if(res.status === 201 || res.status === 200) videoUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
        }
        await db.collection("health_posts").add({ 
            author: userName, text, imageUrl, videoUrl, likes: 0, hahas: 0, 
            likedBy: [], hahaedBy: [], comments: [], isPinned: false, createdAt: Date.now() 
        });
        location.reload();
    } catch (e) { alert("Error: " + e); btn.disabled = false; }
}

// ကျန်သော function များ (Rating, Delete, Pin) ကို အရင်အတိုင်းထားနိုင်ပါသည်...
async function deletePost(id) { if(confirm("ဖျက်မှာလား?")) await db.collection("health_posts").doc(id).delete(); }
async function togglePin(id, status) { await db.collection("health_posts").doc(id).update({ isPinned: !status }); }
async function addComment(id) {
    const val = document.getElementById(`in-${id}`).value;
    if(!val) return;
    const nc = { id: Date.now().toString(), author: userName, text: val, likes: 0, hahas: 0, likedBy: [], hahaedBy: [], createdAt: Date.now() };
    await db.collection("health_posts").doc(id).update({ comments: firebase.firestore.FieldValue.arrayUnion(nc) });
    document.getElementById(`in-${id}`).value = "";
}
async function reactComment(pId, cId, type) {
    const uid = auth.currentUser.uid;
    const ref = db.collection("health_posts").doc(pId);
    const d = (await ref.get()).data();
    const comments = d.comments.map(c => {
        if (c.id === cId) {
            const list = type === 'likes' ? 'likedBy' : 'hahaedBy';
            const count = type === 'likes' ? 'likes' : 'hahas';
            if (!c[list]) c[list] = [];
            if (c[list].includes(uid)) {
                c[list] = c[list].filter(i => i !== uid);
                c[count] = Math.max(0, (c[count] || 1) - 1);
            } else {
                c[list].push(uid);
                c[count] = (c[count] || 0) + 1;
            }
        } return c;
    });
    await ref.update({ comments });
}
function setupRatingSystem() {
    const r = document.getElementById('ratingSection'); if(!r) return;
    r.innerHTML = `<div style="background:#fff; padding:15px; border-radius:12px; margin-top:20px; border:1px solid #ddd;">
        <h4>Rating & Feedback</h4>
        <div id="stars" style="font-size:24px; color:#ddd; cursor:pointer;">
            <span onclick="setStar(1)">★</span><span onclick="setStar(2)">★</span><span onclick="setStar(3)">★</span><span onclick="setStar(4)">★</span><span onclick="setStar(5)">★</span>
        </div>
        <textarea id="feedbackText" placeholder="အကြံပြုချက်..." style="width:100%; margin:10px 0; padding:8px; border-radius:8px; border:1px solid #ddd;"></textarea>
        <button onclick="submitFeedback()" style="background:purple; color:#fff; border:none; padding:10px; border-radius:8px; width:100%;">ပို့မည်</button>
    </div>`;
}
let selectedStars = 0;
function setStar(n) { selectedStars = n; document.querySelectorAll('#stars span').forEach((s,i)=>s.style.color=i<n?'#ffc107':'#ddd'); }
async function submitFeedback() {
    const t = document.getElementById('feedbackText').value; if(!selectedStars) return alert("Star ရွေးပေးပါ။");
    await db.collection("app_feedback").add({ userName, stars: selectedStars, text: t, createdAt: Date.now() });
    alert("ကျေးဇူးတင်ပါတယ်!"); setStar(0); document.getElementById('feedbackText').value="";
}
