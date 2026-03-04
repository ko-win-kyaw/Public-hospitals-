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

// Global variables for pagination
let lastVisiblePost = null;
let isFetching = false;

async function getMyDeviceId() {
    try {
        if (typeof FingerprintJS === 'undefined') {
            console.error("FingerprintJS library not found.");
            return "unknown_device_id";
        }
        if (!fpAgent) {
            fpAgent = await FingerprintJS.load();
        }
        const result = await fpAgent.get();
        return result.visitorId;
    } catch (e) {
        console.error("Fingerprint Error:", e);
        return "error_generating_id";
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
    return date.toLocaleDateString('my-MM', { day: 'numeric', month: 'short', year: 'numeric' });
}

const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.8) {
            video.pause();
        } else {
            if (!video.dataset.hasListener) {
                video.addEventListener('click', () => {
                    if (video.paused) {
                        video.play().catch(e => console.error("Play error:", e));
                    } else {
                        video.pause();
                    }
                });
                video.dataset.hasListener = "true";
                video.style.cursor = "pointer";
            }
        }
    });
}, { threshold: [0.8] });

async function loadPosts(collectionName = "health_posts") {
    try {
        const postsContainer = document.getElementById('newsFeed');
        if (!postsContainer) return;
        
        postsContainer.innerHTML = '<div style="text-align:center; padding:20px;">⏳ ပို့စ်များ ဖတ်နေသည်...</div>';
        
        const snapshot = await db.collection(collectionName)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            postsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">📭 ပို့စ်မရှိသေးပါ</div>';
            return;
        }
        
        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        
        let html = '';
        snapshot.forEach(doc => {
            const post = doc.data();
            post.id = doc.id;
            html += renderPostHTML(doc.id, post, auth.currentUser?.uid, auth.currentUser?.email === ADMIN_EMAIL);
        });
        
        postsContainer.innerHTML = html;
        
        // Add load more button
        html += `<div style="text-align:center; margin:20px;">
            <button onclick="loadMorePosts('${collectionName}')" style="background:purple; color:white; border:none; padding:10px 20px; border-radius:5px;"> Load More </button>
        </div>`;
        
        // Observe videos
        setTimeout(() => {
            document.querySelectorAll('video').forEach(v => videoObserver.observe(v));
        }, 500);
        
    } catch (error) {
        console.error("Load posts error:", error);
        document.getElementById('newsFeed').innerHTML = '<div style="color:red; padding:20px;">❌ ပို့စ်ဖတ်လို့မရပါ</div>';
    }
}

async function loadMorePosts(collectionName = "health_posts") {
    if (isFetching || !lastVisiblePost) return;
    
    isFetching = true;
    
    try {
        const snapshot = await db.collection(collectionName)
            .orderBy('createdAt', 'desc')
            .startAfter(lastVisiblePost)
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            isFetching = false;
            return;
        }
        
        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        
        let html = '';
        snapshot.forEach(doc => {
            const post = doc.data();
            post.id = doc.id;
            html += renderPostHTML(doc.id, post, auth.currentUser?.uid, auth.currentUser?.email === ADMIN_EMAIL);
        });
        
        document.getElementById('newsFeed').insertAdjacentHTML('beforeend', html);
        
        // Observe new videos
        setTimeout(() => {
            document.querySelectorAll('video').forEach(v => videoObserver.observe(v));
        }, 500);
        
    } catch (error) {
        console.error("Load more error:", error);
    } finally {
        isFetching = false;
    }
}

function refreshPosts(collectionName = "health_posts") {
    lastVisiblePost = null;
    loadPosts(collectionName);
}
function cleanupPosts() {
}

function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const timeDisplay = formatTime(d.createdAt);

    let media = "";
    const originalViewStyle = "width:100%; height:auto; display:block; border-radius:8px; cursor:pointer; object-fit:contain; background:#f0f0f0; margin-top:10px;";

    if (d.mediaUrls && d.mediaUrls.length > 0) {
        if (d.mediaType === 'video') {
            let finalVideoUrl = d.mediaUrls[0];
            if (finalVideoUrl.includes('b-cdn.net') && !finalVideoUrl.includes('b-cdn.net/public-hospitals/')) {
                finalVideoUrl = finalVideoUrl.replace('b-cdn.net/', 'b-cdn.net/public-hospitals/');
            }
            media = `
                <div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                    <video src="${finalVideoUrl}" controls onplay="incrementView('${id}')" preload="metadata" playsinline webkit-playsinline style="width:100%; display:block;"></video>
                </div>`;
        } else {
            media = `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">`;
            d.mediaUrls.forEach(url => {
                media += `<img src="${url}" style="${originalViewStyle}" onclick="incrementView('${id}'); viewFullImage('${url}')">`;
            });
            media += `</div>`;
        }
    } 
    else if (d.mediaUrl) {
        if (d.mediaType === 'video' || d.mediaUrl.toLowerCase().includes('.mp4')) {
            let finalVideoUrl = d.mediaUrl;
            if (finalVideoUrl.includes('b-cdn.net') && !finalVideoUrl.includes('b-cdn.net/public-hospitals/')) {
                finalVideoUrl = finalVideoUrl.replace('b-cdn.net/', 'b-cdn.net/public-hospitals/');
            }
            media = `
                <div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                    <video src="${finalVideoUrl}" controls onplay="incrementView('${id}')" preload="metadata" playsinline webkit-playsinline style="width:100%; display:block;"></video>
                </div>`;
        } else {
            media = `<img onclick="incrementView('${id}'); viewFullImage('${d.mediaUrl}')" src="${d.mediaUrl}" style="${originalViewStyle}">`;
        }
    }

    return `
        <div class="post-card" style="background:white; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
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

            <p style="margin: 5px 0 10px 0; white-space: pre-wrap; font-size: 14px; text-align: left; color: #333; line-height: 1.5;">${d.text || ""}</p>
            
            ${media}
            
            <div style="display: flex; justify-content: space-between; margin-top: 12px; border-top: 1px solid #eee; padding-top: 10px;">
                <div style="display: flex; gap: 15px;">
                    <span onclick="handleReact('${id}', 'likes', event)" style="cursor:pointer; font-weight:bold; color:${isLiked?'blue':'gray'}; font-size:14px;">
                        👍 Like (<span class="like-count">${d.likes||0}</span>)
                    </span>
                    <span onclick="handleReact('${id}', 'hahas', event)" style="cursor:pointer; font-weight:bold; color:${isHahaed?'orange':'gray'}; font-size:14px;">
                        😆 Haha (<span class="haha-count">${d.hahas||0}</span>)
                    </span>
                </div>
                <div style="font-size: 12px; color: gray;">
                    👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares||0})</span>
                </div>
            </div>

            <div style="margin-top: 10px;">
                <div id="comms-${id}" style="max-height: 300px; overflow-y: auto;">
                    ${renderComments ? renderComments(id, d.comments, isAdmin, uid) : ''}
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 10px; align-items: center;">
                    <input type="text" id="in-${id}" placeholder="မှတ်ချက်ပေးပါ..." 
                        style="flex:1; border-radius: 20px; border: 1px solid #ddd; padding: 8px 15px; font-size: 13px; outline: none; background: #f0f2f5;"
                        onkeypress="if(event.key === 'Enter') addComment('${id}')">
                    <button onclick="addComment('${id}')" 
                        style="background: purple; color: white; border: none; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;">
                        ➤
                    </button>
                </div>
            </div>
        </div>`;
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

async function uploadAndPost() {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const fileInput = document.getElementById('mediaInput');
    const files = Array.from(fileInput.files);
    const text = document.getElementById('postContent').value.trim();
    const btn = document.getElementById('btnPost');

    try {
        const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        const isPremium = userData.isCrown === true || userData.isGold === true;

        const maxFiles = isPremium ? 10 : 1;
        const maxVideoSize = isPremium ? 60 * 1024 * 1024 : 20 * 1024 * 1024;

        if (files.length > maxFiles) return alert(`သင့်အဆင့်အတန်းအရ တစ်ခါတင်ရင် ${maxFiles} ဖိုင်သာ ခွင့်ပြုပါတယ်!`);
        if (!text && files.length === 0) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ");

        btn.disabled = true;
        btn.innerText = "တင်နေသည်...";

        let mediaUrls = [];
        let mediaType = "";

        for (let file of files) {
            const isVideo = file.type.startsWith('video/');
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            if (isVideo) {
                if (file.size > maxVideoSize) throw new Error(`ဗီဒီယိုဆိုဒ် ${isPremium ? '60MB' : '20MB'} ထက် ကျော်နေပါတယ်`);
                mediaType = 'video';
                
                const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { 
                    method: 'PUT', headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: file
                });
                if (res.ok) mediaUrls.push(`https://public-hospitals.b-cdn.net/${fileName}`);
                
                if (files.length > 1 && isVideo) break; 
            } else {
                mediaType = 'image';
                const fd = new FormData();
                fd.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) mediaUrls.push(data.data.url);
            }
        }

        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            uid: auth.currentUser.uid,
            text: text,
            mediaUrls: mediaUrls,
            mediaType: mediaType,
            isCrown: userData.isCrown || false,
            isGold: userData.isGold || false,
            likes: 0, views: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('postContent').value = "";
        fileInput.value = "";
        if(document.getElementById('mediaPreviewBox')) {
            document.getElementById('mediaPreviewBox').style.display = 'none';
            document.getElementById('mediaPreviewBox').innerHTML = '';
        }
        alert("တင်ပြီးပါပြီ Senior!");
        
        // Refresh posts
        refreshPosts('health_posts');
        
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "တင်မည်";
    }
}

async function handleReact(id, type, event) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    // UI ကို ချက်ချင်းပြောင်းလဲရန် (Optimistic Update)
    const btn = event.currentTarget;
    const countSpan = btn.querySelector(type === 'likes' ? '.like-count' : '.haha-count');
    let currentCount = parseInt(countSpan?.innerText || 0);
    const uid = auth.currentUser.uid;
    
    const ref = db.collection("health_posts").doc(id);
    const snap = await ref.get();
    const d = snap.data();
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    if (d[field]?.includes(uid)) {
        // UI မှာ ချက်ချင်းလျှော့ပြမယ်
        btn.style.color = 'gray';
        if (countSpan) countSpan.innerText = Math.max(0, currentCount - 1);
        
        // Database update
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayRemove(uid), [countField]: firebase.firestore.FieldValue.increment(-1) });
    } else {
        // UI မှာ ချက်ချင်းတိုးပြမယ်
        btn.style.color = type === 'likes' ? 'blue' : 'orange';
        if (countSpan) countSpan.innerText = currentCount + 1;
        
        // Database update
        await ref.update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid), [countField]: firebase.firestore.FieldValue.increment(1) });
    }
}

async function addComment(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const inputField = document.getElementById(`in-${id}`);
    const val = inputField.value.trim();
    if (!val) return;

    try {
        const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        const newComment = {
            uid: auth.currentUser.uid, 
            author: auth.currentUser.displayName || "User", 
            isCrown: userData.isCrown || false,
            isGold: userData.isGold || false,
            text: val,
            likes: 0, likedBy: [], hahas: 0, hahaedBy: [], 
            createdAt: Date.now()
        };

        const ref = db.collection("health_posts").doc(id);
        await ref.update({
            comments: firebase.firestore.FieldValue.arrayUnion(newComment)
        });

        inputField.value = ""; // စာသားကို ချက်ချင်းဖျက်မယ်

        // UI ကို Page reload လုပ်စရာမလိုဘဲ ချက်ချင်း Update လုပ်မယ်
        const snap = await ref.get();
        const comments = snap.data().comments;
        const isAdmin = auth.currentUser.email === ADMIN_EMAIL;
        document.getElementById(`comms-${id}`).innerHTML = renderComments(id, comments, isAdmin, auth.currentUser.uid);
        
    } catch (e) {
        console.error(e);
    }
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
    
    let isAddingReaction = false;

    if (c[f].includes(uid)) {
        c[f] = c[f].filter(x => x !== uid);
        c[cf] = Math.max(0, (c[cf] || 0) - 1);
    } else {
        c[f].push(uid);
        c[cf] = (c[cf] || 0) + 1;
        isAddingReaction = true; 
    }

    // Database update
    await ref.update({ comments });

    // UI ကို ချက်ချင်း Refresh လုပ်ပေးခြင်း (ဒါမှ ဂဏန်းတွေ ချက်ချင်းတိုးမှာပါ)
    const isAdmin = auth.currentUser.email === ADMIN_EMAIL;
    document.getElementById(`comms-${postId}`).innerHTML = renderComments(postId, comments, isAdmin, uid);

    // Notification Logic (နဂိုအတိုင်းထားရှိပါသည်)
    if (isAddingReaction && c.uid !== uid) {
        const reactionName = type === 'likes' ? "Like ❤️" : "Haha 😂";
        db.collection("notifications").add({
            receiverId: c.uid,
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

async function togglePin(id, current) { 
    await db.collection("health_posts").doc(id).update({ isPinned: !current }); 
}

async function deletePost(id) { 
    if(confirm("ဖျက်မှာလား Senior?")) {
        await db.collection("health_posts").doc(id).delete();
        refreshPosts('health_posts');
    }
}

async function incrementView(id) { 
    db.collection("health_posts").doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }); 
}

async function handleShare(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    try {
        const ref = db.collection("health_posts").doc(id);
        const snap = await ref.get();
        const d = snap.data();

        await ref.update({ shares: firebase.firestore.FieldValue.increment(1) });

        await db.collection("health_posts").add({
            ...d,
            author: `${auth.currentUser.displayName} (Shared)`,
            uid: "shared_post", 
            likes: 0, likedBy: [], 
            hahas: 0, hahaedBy: [], 
            comments: [], 
            shares: 0,
            views: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Shared to News Feed!");
        refreshPosts('health_posts');
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
            box.innerHTML = `<video src="${url}" style="width:100%; border-radius:8px;" controls muted></video>`;
        } else {
            box.innerHTML = `<img src="${url}" style="width:100%; border-radius:8px;">`;
        }
    }
}

function clearPreview() {
    const box = document.getElementById('mediaPreviewBox');
    if (box) {
        box.style.display = 'none';
        box.innerHTML = '';
        document.getElementById('mediaInput').value = '';
    }
}

function viewFullImage(imgSrc) {
    // Simple implementation
    window.open(imgSrc, '_blank');
}
function isSafeName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // မြန်မာစာ၊ အင်္ဂလိပ်စာနှင့် ဂဏန်းများသာ ခွင့်ပြုသည်
    // \u1000-\u109F = မြန်မာစာလုံးများ
    // a-zA-Z = အင်္ဂလိပ်စာ
    // 0-9 = ဂဏန်းများ
    // \s = space (နေရာလွတ်)
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s]+$/;
    
    // နာမည်အစနဲ့အဆုံးမှာ space မပါအောင်လည်း စစ်ဆေးခြင်း
    const hasLeadingTrailingSpace = name.startsWith(' ') || name.endsWith(' ');
    
    return safePattern.test(name) && !hasLeadingTrailingSpace;
}
async function saveInitialName() {
    // ၁။ Input Element ရှိမရှိ စစ်ဆေးခြင်း
    const nameElement = document.getElementById('setupUserName');
    if (!nameElement) {
        console.error("Name input element not found!");
        return alert("System Error: Name input not found. Please refresh the page.");
    }

    // ၂။ User Authentication စစ်ဆေးခြင်း
    const user = auth.currentUser;
    if (!user) {
        alert("ကျေးဇူးပြု၍ Login အရင်ဝင်ပါ။");
        // Login Modal ပြသရန် (optional)
        if (typeof showPhoneLogin === 'function') {
            showPhoneLogin();
        }
        return;
    }

    // ၃။ Input Value ရယူပြီး Trim လုပ်ခြင်း
    const inputName = nameElement.value.trim();
    
    // ၄။ နာမည်အလွတ်စစ်ဆေးခြင်း
    if (!inputName) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("အမည်ထည့်သွင်းပေးပါ။");
    }
    
    // ၅။ အနည်းဆုံး စာလုံးရေ ၂ လုံး စစ်ဆေးခြင်း
    if (inputName.length < 2) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("အမည်သည် အနည်းဆုံး ၂ လုံး ရှိရပါမည်။");
    }
    
    // ၆။ အများဆုံး စာလုံးရေ သတ်မှတ်ခြင်း (Optional)
    if (inputName.length > 30) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("အမည်သည် အများဆုံး ၃၀ လုံးသာ ထည့်နိုင်ပါသည်။");
    }
    
    // ၇။ နာမည် Safe ဟုတ်မဟုတ် စစ်ဆေးခြင်း (Special Characters, Emoji များ)
    if (!isSafeName(inputName)) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("Senior ရေ... နာမည်မှာ မြန်မာစာ၊ အင်္ဂလိပ်စာနဲ့ ဂဏန်းများသာ ထည့်နိုင်ပါသည်။ Emoji နဲ့ Special Character တွေ မသုံးပါနဲ့။");
    }
    
    // ၈။ Duplicate Name စစ်ဆေးခြင်း (Optional - Database မှာ နာမည်တူရှိလား)
    try {
        const existingUserQuery = await db.collection("users")
            .where("displayName", "==", inputName)
            .limit(1)
            .get();
        
        if (!existingUserQuery.empty && existingUserQuery.docs[0].id !== user.uid) {
            return alert("ဤအမည်ကို အခြားသူတစ်ဦးက အသုံးပြုနေပါသည်။ ကျေးဇူးပြု၍ အခြားနာမည်ရွေးချယ်ပါ။");
        }
    } catch (e) {
        // Query error ဖြစ်ရင် ဆက်လုပ်မယ် (Optional feature)
        console.warn("Name duplicate check failed:", e);
    }

    // ၉။ Loading State ပြသခြင်း
    const saveButton = nameElement.nextElementSibling || document.querySelector('#nameSetupModal button');
    const originalButtonText = saveButton ? saveButton.innerText : "အတည်ပြုမည်";
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerText = "သိမ်းဆည်းနေသည်...";
    }

    try {
        // ၁၀။ Firebase Auth Profile Update
        await user.updateProfile({ 
            displayName: inputName 
        });

        // ၁၁။ Firestore Database Update (User Data)
        await db.collection("users").doc(user.uid).set({
            displayName: inputName,
            isProfileSetup: true,
            setupCompletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // ၁၂။ UI Update (Name Display ကို ချက်ချင်းပြောင်းခြင်း)
        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) {
            userNameDisplay.innerText = inputName;
        }

        // ၁၃။ Modal ကိုပိတ်ခြင်း
        const modal = document.getElementById('nameSetupModal');
        if (modal) {
            modal.style.display = 'none';
        }

        // ၁၄။ Success Message ပြသခြင်း
        console.log("✅ Name updated successfully to:", inputName);
        
        // Optional: Toast Message ပြသခြင်း
        showToastMessage("နာမည် သိမ်းဆည်းပြီးပါပြီ။", "success");
        
        // ၁၅။ လိုအပ်ရင် Page Reload (Optional)
        // location.reload(); // ဒါအစား UI ကိုပဲ update လုပ်တာပိုကောင်း
        
    } catch (error) {
        // ၁၆။ Error Handling အပြည့်အစုံ
        console.error("❌ Error saving name:", error);
        
        let errorMessage = "နာမည်သိမ်းဆည်းခြင်း မအောင်မြင်ပါ။ ";
        
        // Firebase Error Code အလိုက် Message ပြောင်းပြသခြင်း
        if (error.code === 'permission-denied') {
            errorMessage += "ခွင့်ပြုချက် မရှိပါ။";
        } else if (error.code === 'unavailable') {
            errorMessage += "Network error ဖြစ်နေပါသည်။ ကျေးဇူးပြု၍ ပြန်ကြိုးစားပါ။";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage += "လုံခြုံရေးအတွက် ပြန် Login ဝင်ပေးပါ။";
            // Redirect to login or show login modal
            if (typeof showPhoneLogin === 'function') {
                setTimeout(() => showPhoneLogin(), 1000);
            }
        } else {
            errorMessage += error.message || "ခဏနေမှ ပြန်လုပ်ကြည့်ပါ။";
        }
        
        alert(errorMessage);
        
        // Input field ကို ပြန် focus လုပ်ခြင်း
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        
    } finally {
        // ၁၇။ Button ကို ပြန် enable လုပ်ခြင်း
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerText = originalButtonText;
        }
        
        // ၁၈။ Border ကို ပြန် reset လုပ်ခြင်း (success ဖြစ်ရင်)
        if (!nameElement.style.border.includes('red')) {
            nameElement.style.border = "1px solid #ddd";
        }
    }
}

function showToastMessage(message, type = 'info') {
    // Toast container ရှိမရှိ စစ်ဆေးခြင်း
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        // Toast container မရှိရင် အသစ်ဆောက်ခြင်း
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // Toast element ဆောက်ခြင်း
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        min-width: 200px;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    // Animation keyframes ထည့်ခြင်း
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    toastContainer.appendChild(toast);
    
    // ၃ စက္ကန့်အကြာမှာ ပျောက်သွားအောင်လုပ်ခြင်း
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
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
    
    // Browser Notification Permission
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    const myUid = auth.currentUser.uid;
    const myIcon = 'https://your-icon-url.png'; // ကိုယ့် icon ထည့်
    
    db.collection("notifications")
        .where("receiverId", "==", myUid)
        .where("status", "==", "unread")
        .onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                if (change.type === "added") {
                    const notif = change.doc.data();
                    
                    // Browser Notification
                    if (Notification.permission === "granted") {
                        new Notification(notif.title || "အသိပေးချက်", {
                            body: notif.body || "",
                            icon: myIcon,
                            badge: myIcon,
                            vibrate: [200, 100, 200]
                        });
                    }
                    
                    // Optional: In-app notification badge update
                    updateNotificationBadge();
                    
                    // Mark as read (optional - ချက်ချင်းမဖတ်ချင်ရင် မလုပ်ပါနဲ့)
                    // db.collection("notifications").doc(change.doc.id).update({ status: "read" });
                }
            });
        });
}

// Notification အရေအတွက် ပြဖို့ function
function updateNotificationBadge() {
    // ကိုယ့် UI အလိုက် ရေးပါ
}

async function submitFeedback() {
    const msg = document.getElementById('feedbackMsg')?.value.trim();
    if (!msg) return alert("စာသားလေး တစ်ခုခု ရေးပေးပါဦး Senior");

    try {
        const user = auth.currentUser;
        if (!user) return alert("Login အရင်ဝင်ပါ");
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

auth.onAuthStateChanged(async (user) => {
    // UI အခြေခံ update
    const userNameDisplay = document.getElementById('userNameDisplay');
    const modal = document.getElementById('nameSetupModal');
    
    if (userNameDisplay) {
        userNameDisplay.innerText = user?.displayName || 'Guest';
    }
    
    if (!user) return;

    try {
        // ၁။ Device ID ရယူခြင်း
        const currentDevId = await Promise.race([
            getMyDeviceId(),
            new Promise(resolve => setTimeout(() => resolve("timeout_id"), 5000))
        ]);

        // ၂။ Ban Status စစ်ဆေးခြင်း
        const isBanned = await checkBanStatus(user.uid, currentDevId);
        if (isBanned) {
            await auth.signOut();
            return;
        }

        // ၃။ Firestore ကနေ User Data အရင်ဖတ်မယ် (Device Lock ရော Name Setup အတွက်ရော သုံးဖို့)
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();
        let existingData = doc.exists ? doc.data() : null;

        // ၄။ Device Lock စစ်ဆေးခြင်း (Admin ကလွဲရင်)
        if (user.email !== ADMIN_EMAIL && existingData) {
            if (currentDevId !== "timeout_id" && 
                existingData.deviceId && 
                existingData.deviceId !== currentDevId) {
                alert("Account Error: Device Lock အလုပ်လုပ်နေပါသည်။");
                await auth.signOut();
                return;
            }
        }

        // ၅။ နာမည်ရှိမရှိ နှင့် Device ကိုက်မကိုက် စစ်ဆေးပြီး Modal ပြခြင်း/ဖျောက်ခြင်း Logic
        // Logic: Firestore မှာ နာမည်ရှိနေရင် သို့မဟုတ် Auth မှာ နာမည်ရှိနေရင် Modal မပြတော့ဘူး
        const hasStoredName = existingData && existingData.displayName;
        const hasAuthName = user.displayName;

        if (hasStoredName || hasAuthName) {
            if (modal) modal.style.display = 'none'; // နာမည်ရှိပြီးသားမို့ ပိတ်ထားမယ်
            if (userNameDisplay) userNameDisplay.innerText = hasStoredName || hasAuthName;
        } else {
            if (modal) modal.style.display = 'flex'; // နာမည်မရှိသေးမှ ပြမယ်
        }

        // ၆။ User Data Update (Firestore)
        const updatePayload = {
            uid: user.uid,
            displayName: hasStoredName || hasAuthName || "User",
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (currentDevId !== "timeout_id") {
            updatePayload.deviceId = currentDevId;
        }
        await userRef.set(updatePayload, { merge: true });

        // ၇။ Auto Friend System နှင့် Notifications
        if (user.uid) {
            startAutoFriendSystem(user.uid).catch(err => console.error("Auto friend system error:", err));
        }
        startLiveNotifications();

    } catch (error) {
        console.error("Auth State Handler Error:", error);
    }
});

// ၁။ နာမည်နှင့် Badge ပြသရန် (ဒါမပါရင် Post တွေ Render မဖြစ်ပါ)
function getDisplayNameWithBadge(d) {
    let badge = "";
    if (d.isCrown) {
        badge = '<span class="badge-official crown-bg" style="background: linear-gradient(45deg, #a020f0, #ff00ff); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px;">👑 Crown</span>';
    } else if (d.isGold) {
        badge = '<span class="badge-official gold-bg" style="background: gold; color: black; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px;">⭐ Gold</span>';
    }
    return `${d.author || "User"} ${badge}`;
}

// ၂။ Ban ဖြစ်ထားခြင်း ရှိမရှိ စစ်ဆေးရန်
async function checkBanStatus(uid, deviceId) {
    try {
        const banDoc = await db.collection("banned_users").doc(uid).get();
        if (banDoc.exists) {
            alert("သင့်အကောင့်သည် ပိတ်ပင်ခံထားရပါသည်။");
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// ၃။ Auto Friend System (Placeholder - Error မတက်အောင် ထည့်ထားပေးခြင်း)
async function startAutoFriendSystem(uid) {
    console.log("Auto friend system started for:", uid);
}

// --- Modified Post Rendering Logic ---
// renderPostHTML ထဲမှာ Image Error Handle လုပ်ခြင်းနှင့် Video Loop ပိုမိုချောမွေ့အောင် ပြင်ထားသည်

function getDisplayNameWithBadge(d) {
    let badge = "";
    if (d.isCrown) badge = '<span class="badge-official crown-bg">👑 Crown</span>';
    else if (d.isGold) badge = '<span class="badge-official gold-bg">⭐ Gold</span>';
    return `${d.author || "User"} ${badge}`;
}
window.auth = firebase.auth();
window.db = firebase.firestore();
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
    saveInitialName,
    showAllComments,
    startLiveNotifications,
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

Object.assign(window, postActions, postLoading);

console.log("Script loaded successfully!");

})();
