// ၁။ Configurations
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com"; 
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

// ၂။ Auth State & Initialization
auth.onAuthStateChanged(user => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const googleBtn = document.getElementById('googleBtn');
    const adminBadge = document.getElementById('adminBadge');

    if (user) {
        if(nameDisplay) nameDisplay.innerText = user.displayName || user.email || user.phoneNumber || "User";
        if(googleBtn) googleBtn.style.display = 'none';
        
        // Gmail တစ်ခုတည်းဖြင့် Admin စစ်ဆေးခြင်း (PIN မလိုတော့ပါ)
        if (user.email === ADMIN_EMAIL && adminBadge) {
            adminBadge.style.display = 'inline-block';
        }
    } else {
        if(nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
        if(googleBtn) googleBtn.style.display = 'block';
    }
    loadPosts();
});

// ၃။ News Feed (မျက်နှာပြင်မပြောင်းစေရန် Optimistic Update စနစ်သုံးထားသည်)
let postsListener = null;
function loadPosts() {
    if (postsListener) postsListener();
    
    // orderBy createdAt အသုံးပြုခြင်း (isPinned ပါလျှင် Index Error တက်တတ်သဖြင့် ဤနေရာတွင် မထည့်ပါ)
    postsListener = db.collection("health_posts").orderBy("createdAt", "desc").onSnapshot(snap => {
        const feed = document.getElementById('newsFeed');
        if (!feed) return;
        
        const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
        const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;

        snap.docChanges().forEach(change => {
            const d = change.doc.data();
            const id = change.doc.id;

            if (change.type === "added") {
                const postHTML = createPostHTML(id, d, uid, isAdmin);
                feed.insertAdjacentHTML('beforeend', postHTML);
            } 
            else if (change.type === "modified") {
                // Modified ဖြစ်လျှင် UI တစ်ခုလုံး Refresh မလုပ်ဘဲ Reaction Count များကိုသာ Update လုပ်သည်
                updatePostUI(id, d, uid);
            } 
            else if (change.type === "removed") {
                const el = document.querySelector(`[data-post-id="${id}"]`);
                if (el) el.remove();
            }
        });
    });
}

function createPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    
    return `
    <div class="post-card" data-post-id="${id}" style="background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; text-align:left; box-shadow:0 1px 3px rgba(0,0,0,0.1); position:relative;">
        ${isAdmin ? `<button onclick="deletePost('${id}')" style="position:absolute; right:10px; top:10px; color:red; border:none; background:none; font-weight:bold; cursor:pointer;">[Delete]</button>` : ''}
        <b style="color:purple; font-size:16px;">${d.author}</b>
        <p style="margin:10px 0; white-space:pre-wrap;">${d.text || ""}</p>
        ${d.mediaType === 'video' ? `<video controls playsinline style="width:100%; border-radius:8px; background:black;"><source src="${d.mediaUrl}"></video>` : ''}
        ${d.mediaType === 'image' ? `<img src="${d.mediaUrl}" style="width:100%; border-radius:8px;">` : ''}
        <div style="display:flex; gap:15px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
            <button id="like-btn-${id}" onclick="handleReact('${id}', 'likes')" style="color:${isLiked?'blue':'gray'}; border:none; background:none; font-weight:bold; cursor:pointer;">👍 Like (<span id="like-count-${id}">${d.likes || 0}</span>)</button>
            <button id="haha-btn-${id}" onclick="handleReact('${id}', 'hahas')" style="color:${isHahaed?'orange':'gray'}; border:none; background:none; font-weight:bold; cursor:pointer;">😆 Haha (<span id="haha-count-${id}">${d.hahas || 0}</span>)</button>
        </div>
        <div id="comments-box-${id}" style="margin-top:10px;">
            ${(d.comments || []).map((c, i) => `<div style="font-size:13px; background:#f0f2f5; padding:8px; border-radius:10px; margin-top:5px;"><b>${c.author}</b>: ${c.text}</div>`).join('')}
        </div>
        <div style="display:flex; gap:5px; margin-top:8px;">
            <input type="text" id="in-${id}" placeholder="မှတ်ချက်..." style="flex:1; border:1px solid #ddd; border-radius:20px; padding:6px 15px;">
            <button onclick="addComment('${id}')" style="color:purple; font-weight:bold; border:none; background:none; cursor:pointer;">Send</button>
        </div>
    </div>`;
}

function updatePostUI(id, d, uid) {
    const likeBtn = document.getElementById(`like-btn-${id}`);
    const hahaBtn = document.getElementById(`haha-btn-${id}`);
    const likeCount = document.getElementById(`like-count-${id}`);
    const hahaCount = document.getElementById(`haha-count-${id}`);

    if (likeBtn) likeBtn.style.color = (d.likedBy || []).includes(uid) ? 'blue' : 'gray';
    if (hahaBtn) hahaBtn.style.color = (d.hahaedBy || []).includes(uid) ? 'orange' : 'gray';
    if (likeCount) likeCount.innerText = d.likes || 0;
    if (hahaCount) hahaCount.innerText = d.hahas || 0;
    
    // Update Comments
    const commBox = document.getElementById(`comments-box-${id}`);
    if (commBox) {
        commBox.innerHTML = (d.comments || []).map(c => `<div style="font-size:13px; background:#f0f2f5; padding:8px; border-radius:10px; margin-top:5px;"><b>${c.author}</b>: ${c.text}</div>`).join('');
    }
}

// ၄။ Optimized Reaction Handler (မျက်နှာပြင် မခုန်စေရန်)
async function handleReact(postId, type) {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    
    const ref = db.collection("health_posts").doc(postId);
    const uid = auth.currentUser.uid;
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    // UI ကို ချက်ချင်းအရင်ပြောင်း (Optimistic Update)
    const countSpan = document.getElementById(`${type}-count-${postId}`);
    const btn = document.getElementById(`${type}-btn-${postId}`);
    let currentVal = parseInt(countSpan.innerText);

    try {
        const doc = await ref.get();
        const data = doc.data();
        if ((data[field] || []).includes(uid)) {
            await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(uid), [countField]: firebase.firestore.FieldValue.increment(-1) });
        } else {
            await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid), [countField]: firebase.firestore.FieldValue.increment(1) });
        }
    } catch (e) { console.error(e); }
}

// ၅။ Admin Functions (Only for uwinkyawdevelopbusinessco@gmail.com)
async function deletePost(id) {
    if (auth.currentUser.email !== ADMIN_EMAIL) return;
    if(confirm("ပို့စ်ကို ဖျက်မှာ သေချာပါသလား?")) await db.collection("health_posts").doc(id).delete();
}

async function addComment(id) {
    if (!auth.currentUser) return alert("မှတ်ချက်ရေးရန် Login ဝင်ပေးပါ");
    const el = document.getElementById(`in-${id}`);
    if (!el.value.trim()) return;
    
    await db.collection("health_posts").doc(id).update({
        comments: firebase.firestore.FieldValue.arrayUnion({
            author: auth.currentUser.displayName || "User",
            text: el.value, createdAt: Date.now()
        })
    });
    el.value = "";
}

// ၆။ Post Upload (Original Logic)
async function uploadAndPost() {
    if (!auth.currentUser) return alert("ဦးစွာ Login ဝင်ပေးပါ");
    const text = document.getElementById('postContent').value.trim();
    const file = document.getElementById('mediaInput').files[0];
    const btn = document.getElementById('btnPost');

    if (file && file.size > MAX_VIDEO_SIZE) return alert("ဖိုင်ဆိုဒ် 20MB ထက်ကျော်နေပါတယ်");

    btn.disabled = true;
    try {
        let mediaUrl = ""; let mediaType = "none";
        if (file) {
            const fileName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
            if (file.type.startsWith("video")) {
                await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, {
                    method: "PUT", headers: { "AccessKey": BUNNY_KEY }, body: file
                });
                mediaUrl = `https://public-hospitals.b-cdn.net/${fileName}`;
                mediaType = "video";
            } else {
                const fd = new FormData(); fd.append("image", file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
                const d = await res.json();
                mediaUrl = d.data.url; mediaType = "image";
            }
        }
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            text, mediaUrl, mediaType, likes: 0, hahas: 0, likedBy: [], hahaedBy: [], comments: [], createdAt: Date.now()
        });
        document.getElementById('postContent').value = "";
    } catch (e) { alert(e.message); }
    btn.disabled = false;
}
