(function() {
// --- ၁။ Firebase & Global Config ---
const firebaseConfig = {
    apiKey: "AIzaSyD4Yiez3VXKD90za0wnt03lFPjeln4su7U",
    authDomain: "hospital-app-caf85.firebaseapp.com",
    projectId: "hospital-app-caf85",
    storageBucket: "hospital-app-caf85.firebasestorage.app",
    messagingSenderId: "736486429191",
    appId: "1:736486429191:web:25c116beb3994d213cd0a2"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();
const auth = firebase.auth();

const ADMIN_EMAIL = "uwinkyawdevelopbusinessco@gmail.com"; 
const IMGBB_KEY = "C8d8d00185e973ebcafddd34f77a1176"; 
const BUNNY_KEY = "a038d7e1-bf94-448b-b863c156422e-7e4a-4299"; 
const BUNNY_STORAGE = "public-hospitals";

let lastVisiblePost = null;
let isFetching = false;
let fpAgent = null; // ဒီကောင်လေး ကျန်ခဲ့လို့ပါ Senior

// --- ၂။ Helper Functions (Time & Device ID) ---
async function getMyDeviceId() {
    try {
        if (typeof FingerprintJS === 'undefined') return "unknown_id";
        if (!fpAgent) fpAgent = await FingerprintJS.load();
        const result = await fpAgent.get();
        return result.visitorId;
    } catch (e) { return "error_id"; }
}

function formatTime(timestamp) {
    if (!timestamp) return "";
    let date = (timestamp && typeof timestamp.toDate === 'function') ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "ခုနကတင်";
    if (diff < 3600) return Math.floor(diff / 60) + " မိနစ်ခန့်က";
    if (diff < 86400) return Math.floor(diff / 3600) + " နာရီခန့်က";
    if (diff < 172800) return "မနေ့က";
    return date.toLocaleDateString('my-MM', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- ၃။ Observers (Logic များကို တစ်ခုတည်းအဖြစ် ပေါင်းစည်းထားသည်) ---
const postViewObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const postId = entry.target.getAttribute('data-id');
            if (postId && typeof incrementView === 'function') {
                incrementView(postId);
                postViewObserver.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.6 });

const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        // ၇၀% မြင်ရမှ Play မယ်၊ ၃၀% ပျောက်ရင် Stop မယ်
        if (entry.intersectionRatio < 0.7) {
            video.pause();
        } else {
            video.muted = true;
            video.play().catch(e => console.log("Auto play blocked:", e));
            
            // Click to Unmute Logic
            if (!video.dataset.hasListener) {
                video.addEventListener('click', () => {
                    video.muted = !video.muted;
                    if (video.paused) video.play();
                });
                video.dataset.hasListener = "true";
                video.style.cursor = "pointer";
            }
        }
    });
}, { threshold: [0, 0.7] });

// window object ထဲထည့်မှ loadPosts က သိမှာပါ
window.postViewObserver = postViewObserver;
window.videoObserver = videoObserver;

// --- ၄။ Core Functions (Load Posts & Render) ---
async function loadPosts(collectionName = "health_posts") {
    try {
        const postsContainer = document.getElementById('newsFeed');
        if (!postsContainer) return;
        postsContainer.innerHTML = '<div style="text-align:center; padding:20px;">⏳ ပို့စ်များ ဖတ်နေသည်...</div>';
        
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;
        const isAdmin = auth.currentUser ? (auth.currentUser.email === ADMIN_EMAIL) : false;

        const snapshot = await db.collection(collectionName)
            .orderBy('isPinned', 'desc')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            postsContainer.innerHTML = '<div style="text-align:center; padding:20px;">📭 ပို့စ်မရှိသေးပါ Senior</div>';
            return;
        }
        
        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        let html = '';
        snapshot.forEach(doc => {
            html += renderPostHTML(doc.id, doc.data(), currentUid, isAdmin);
        });

        html += `<div id="scroll-trigger" style="text-align:center; margin:20px;">
            <button onclick="loadMorePosts('${collectionName}')" style="background:purple; color:white; border:none; padding:10px 20px; border-radius:5px;">Load More</button>
        </div>`;
        
        postsContainer.innerHTML = html;

        setTimeout(() => {
            document.querySelectorAll('video').forEach(v => {
                v.muted = true;
                v.setAttribute('playsinline', '');
                window.videoObserver.observe(v);
            });
            document.querySelectorAll('.post-card').forEach(p => {
                window.postViewObserver.observe(p);
            });
        }, 800);
        
    } catch (error) {
        console.error("Load posts error:", error);
        document.getElementById('newsFeed').innerHTML = `❌ Error: ${error.message}`;
    }
}


async function loadMorePosts(collectionName = "health_posts") {
    if (isFetching || !lastVisiblePost) return;
    
    isFetching = true;
    
    try {
        // loadPosts က Query အစဉ်အတိုင်း (isPinned -> createdAt) ဖြစ်ရပါမည်
        const snapshot = await db.collection(collectionName)
            .orderBy('isPinned', 'desc') // Pin posts များကို အပေါ်ထားရန်
            .orderBy('createdAt', 'desc') // ကျန်တာကို အချိန်အလိုက်စီရန်
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
        
        // Load More ခလုတ် မပျောက်သွားစေရန် ခလုတ်ရှေ့မှာ HTML အသစ်ထည့်ခြင်း
        const newsFeed = document.getElementById('newsFeed');
        const loadMoreBtnContainer = newsFeed.querySelector('div:last-child');
        
        if (loadMoreBtnContainer && loadMoreBtnContainer.innerHTML.includes('Load More')) {
            loadMoreBtnContainer.insertAdjacentHTML('beforebegin', html);
        } else {
            newsFeed.insertAdjacentHTML('beforeend', html);
        }
        
        // ဗီဒီယိုအသစ်များကို Auto-play အတွက် Observe လုပ်ခြင်း
        setTimeout(() => {
            document.querySelectorAll('video').forEach(v => {
                if(window.videoObserver) videoObserver.observe(v);
            });
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

    // --- ၁။ SEE MORE LOGIC (စာရှည်ရင် ဖြတ်ပြတာ မူရင်းအတိုင်း) ---
    const isLongText = (d.text && d.text.length > 200);
    let textHTML = `<div id="text-${id}" class="post-text" style="margin:5px 0 10px 0; white-space:pre-wrap; font-size:14px; text-align:left; color:#333; line-height:1.5;">${d.text || ""}</div>`;
    if (isLongText) {
        textHTML += `<span id="btn-${id}" class="see-more-btn" style="color:purple; font-weight:bold; cursor:pointer; font-size:13px;" onclick="toggleText('${id}')">... See More</span>`;
    }

    // --- ၂။ VIDEO URL SAFE (Bunny CDN Logic မူရင်းအတိုင်း) ---
    const getSafeVideoUrl = (url) => {
        if (!url) return "";
        let finalUrl = url;
        if (finalUrl.includes("b-cdn.net") && !finalUrl.includes("b-cdn.net/public-hospitals/")) {
            finalUrl = finalUrl.replace("b-cdn.net/", "b-cdn.net/public-hospitals/");
        }
        return finalUrl.includes("#t=") ? finalUrl : `${finalUrl}#t=0.001`;
    };

    // --- ၃။ MEDIA HANDLING (ARRAY ရော SINGLE ရော ပါဝင်ပြီး အသံပိတ် AUTO-PLAY အတွက် ပြင်ဆင်ထားသည်) ---
    if (d.mediaUrls && d.mediaUrls.length > 0) {
        if (d.mediaType === "video") {
            const safeVideo = getSafeVideoUrl(d.mediaUrls[0]);
            // အသံပိတ် Auto-play အတွက် muted, playsinline, poster တို့ကို ထည့်သွင်းထားသည်
            media = `<div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                        <video src="${safeVideo}" preload="metadata" muted playsinline webkit-playsinline poster="${safeVideo}" style="width:100%; display:block; min-height:200px; background:#000;"></video>
                     </div>`;
        } else {
            const count = d.mediaUrls.length;
            const gridClass = count >= 4 ? "grid-4" : `grid-${count}`;
            const displayCount = count > 4 ? 4 : count;
            const photosJson = encodeURIComponent(JSON.stringify(d.mediaUrls));
            media = `<div class="photo-grid ${gridClass}">`;
            for (let i = 0; i < displayCount; i++) {
                const isLast = (i === 3 && count > 4);
                media += `<div class="grid-item" onclick="openPhotoViewer(${i}, '${photosJson}')"><img src="${d.mediaUrls[i]}" loading="lazy">${isLast ? `<div class="more-overlay">+${count - 3}</div>` : ""}</div>`;
            }
            media += `</div>`;
        }
    } else if (d.mediaUrl) {
        if (d.mediaType === "video" || d.mediaUrl.toLowerCase().includes(".mp4")) {
            const safeVideo = getSafeVideoUrl(d.mediaUrl);
            media = `<div style="margin-top:10px; background:#000; border-radius:8px; overflow:hidden;">
                        <video src="${safeVideo}" preload="metadata" muted playsinline webkit-playsinline poster="${safeVideo}" style="width:100%; display:block; min-height:200px; background:#000;"></video>
                     </div>`;
        } else {
            const singlePhotoJson = encodeURIComponent(JSON.stringify([d.mediaUrl]));
            media = `<img onclick="openPhotoViewer(0,'${singlePhotoJson}')" src="${d.mediaUrl}" loading="lazy" style="${originalViewStyle}">`;
        }
    }

    // --- ၄။ FINAL UI (မူရင်း UI Layout တစ်ချက်မှ မလွဲစေဘဲ ပြန်ထုတ်ပေးသည်) ---
    return `
    <div class="post-card" data-id="${id}" style="background:white; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <b style="color:purple; font-size:15px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    ${getDisplayNameWithBadge(d)}
                </b>
                <small style="color:gray; font-size:11px;">${timeDisplay}</small>
            </div>
            <div style="display:flex; gap:10px; flex-shrink:0; margin-left:10px;">
                ${isAdmin ? `<button onclick="togglePin('${id}', ${d.isPinned || false})" style="border:none; background:none; cursor:pointer; padding:0; font-size:16px;">${d.isPinned ? "📌" : "📍"}</button>` : ""}
                ${isAdmin ? `<button onclick="deletePost('${id}')" style="border:none; background:none; cursor:pointer; padding:0; font-size:16px;">🗑️</button>` : ""}
            </div>
        </div>

        ${textHTML} ${media}

        <div style="display:flex; justify-content:space-between; margin-top:12px; border-top:1px solid #eee; padding-top:10px;">
            <div style="display:flex; gap:15px;">
                <span onclick="handleReact('${id}','likes',event)" style="cursor:pointer; font-weight:bold; color:${isLiked ? "blue" : "gray"}; font-size:14px;">
                    👍 Like (<span class="like-count">${d.likes || 0}</span>)
                </span>
                <span onclick="handleReact('${id}','hahas',event)" style="cursor:pointer; font-weight:bold; color:${isHahaed ? "orange" : "gray"}; font-size:14px;">
                    😆 Haha (<span class="haha-count">${d.hahas || 0}</span>)
                </span>
            </div>
            <div style="font-size:12px; color:gray;">
                👁️ ${d.views || 0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares || 0})</span>
            </div>
        </div>

        <div style="margin-top:10px;">
            <div id="comms-${id}" style="max-height:300px; overflow-y:auto;">
                ${typeof renderComments === "function" ? renderComments(id, d.comments, isAdmin, uid) : ""}
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; align-items:center;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်ပေးပါ..." style="flex:1; border-radius:20px; border:1px solid #ddd; padding:8px 15px; font-size:13px; outline:none; background:#f0f2f5;" onkeypress="if(event.key === 'Enter') addComment('${id}')">
                <button onclick="addComment('${id}')" style="background:purple; color:white; border:none; border-radius:50%; width:35px; height:35px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px;">➤</button>
            </div>
        </div>
    </div>`;
}

async function deletePost(id) { 
    // ၁။ Confirm လုပ်ခြင်း
    if(!confirm("ဖျက်မှာလား Senior? ပုံ၊ ဗီဒီယိုနဲ့ Share ထားတဲ့ ပို့စ်တွေပါ အကုန်အပြီးဖျက်မှာနော်...")) return;

    try {
        // ၂။ ဖျက်မည့် Post Data ကို အရင်ယူခြင်း (Media URLs ယူရန်)
        const snap = await db.collection("health_posts").doc(id).get();
        if (!snap.exists) return alert("Post မရှိတော့ပါဘူး Senior");
        
        const d = snap.data();
        const urls = d.mediaUrls || (d.mediaUrl ? [d.mediaUrl] : []);

        // ၃။ Bunny Storage ထဲက ဖိုင်များကို လိုက်ဖျက်ခြင်း
        for (const url of urls) {
            if (url && url.includes('b-cdn.net')) {
                await deleteFromBunny(url);
            } else if (url && url.includes('ibb.co')) {
                console.log("ImgBB ဖိုင်ကို Dashboard မှာ ဖျက်ပေးပါ Senior:", url);
            }
        }

        // ၄။ 'shares' collection ထဲက ပတ်သက်သမျှ post များကို Batch ဖြင့် ဖျက်ခြင်း
        const sharedPostsQuery = await db.collection("shares")
            .where("originalPostId", "==", id)
            .get();
        
        const batch = db.batch();
        
        // မူရင်း Post ကိုပါ batch ထဲ တစ်ခါတည်းထည့်ဖျက်မယ်
        batch.delete(db.collection("health_posts").doc(id));
        
        // Shared ပို့စ်များကို လိုက်ထည့်မယ်
        sharedPostsQuery.forEach(doc => {
            batch.delete(doc.ref);
        });

        // အားလုံးကို တစ်ခါတည်း commit လုပ်မယ်
        await batch.commit();

        // ၅။ UI ကို Refresh လုပ်ခြင်း
        if (typeof loadPosts === 'function') {
            loadPosts('health_posts');
        } else {
            location.reload();
        }
        
        alert("မူရင်း၊ Shared post များ နှင့် Store ဖိုင်များ အားလုံး အောင်မြင်စွာ ဖျက်ပြီးပါပြီ Senior");

    } catch (error) {
        console.error("Delete error:", error);
        alert("ဖျက်လို့မရပါဘူး Senior: " + error.message);
    }
}

// --- Bunny Storage ကနေ ဖိုင်ဖျက်တဲ့ Function ---
async function deleteFromBunny(fileUrl) {
    try {
        // URL ထဲကနေ ဖိုင်နာမည်ကို ထုတ်ယူမယ် (ဥပမာ- image.jpg)
        const fileName = fileUrl.split('/').pop();
        const url = `https://storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'AccessKey': BUNNY_KEY
            }
        });

        if (response.ok) {
            console.log("Bunny file deleted successfully");
        }
    } catch (e) {
        console.error("Bunny delete error:", e);
    }
}

function renderComments(postId, comments, isAdmin, uid) {
    if (!comments || comments.length === 0) return "";

    // ၁။ Reaction အများဆုံးကို ထိပ်ဆုံးတင်ဖို့ Sort လုပ်တာ
    const sortedComments = [...comments].sort((a, b) => {
        const scoreA = (a.likes || 0) + (a.hahas || 0);
        const scoreB = (b.likes || 0) + (b.hahas || 0);
        return scoreB - scoreA;
    });

    const limit = 5;
    const hasMore = sortedComments.length > limit;
    
    // ပထမဆုံး ၅ ခုကိုပဲ အရင်ပြမယ်
    const displayedComments = sortedComments.slice(0, limit);
    const hiddenComments = sortedComments.slice(limit);

    // Comment တစ်ခုချင်းစီကို HTML ပြောင်းတဲ့ Function
    const generateCommentHTML = (c, index, isHiddenPart = false) => {
        const originalIndex = comments.indexOf(c);
        const commId = `${postId}-comm-${isHiddenPart ? 'extra-' : ''}${index}`;
        
        // စာလုံးရေ ၁၀၀ ကျော်ရင် See More ပြဖို့တွက်တာ
        const isLongComm = (c.text && c.text.length > 100);
        const isTop = (!isHiddenPart && index === 0 && ((c.likes || 0) + (c.hahas || 0) > 0));

        return `
        <div style="background:#f0f2f5; margin-bottom:5px; padding:8px; border-radius:8px; font-size:12px; text-align:left; border-left:${isTop ? '4px solid gold' : ''}">
            ${isTop ? '<small style="color:#d4af37; font-weight:bold;">🏆 Top Comment</small><br>' : ''}
            <b>${getDisplayNameWithBadge(c)}</b>: 
            
            <div id="text-${commId}" class="comment-text" style="white-space:pre-wrap; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
                ${c.text}
            </div>
            
            ${isLongComm ? `<span id="btn-${commId}" class="see-more-btn" style="color:purple; font-weight:bold; cursor:pointer; font-size:11px; display:block; margin-top:3px;" onclick="toggleText('${commId}')">... See More</span>` : ""}
            
            <div style="margin-top:4px; display:flex; gap:10px;">
                <span onclick="reactComment('${postId}', ${originalIndex}, 'likes')" style="cursor:pointer; color:${(c.likedBy || []).includes(uid) ? 'blue' : 'gray'}">
                    👍 ${c.likes || 0}
                </span>
                <span onclick="reactComment('${postId}', ${originalIndex}, 'hahas')" style="cursor:pointer; color:${(c.hahaedBy || []).includes(uid) ? 'orange' : 'gray'}">
                    😆 ${c.hahas || 0}
                </span>
                ${isAdmin ? `<span onclick="deleteComment('${postId}', ${originalIndex})" style="color:red; cursor:pointer; margin-left:auto;">ဖျက်ရန်</span>` : ''}
            </div>
        </div>`;
    };

    let html = displayedComments.map((c, i) => generateCommentHTML(c, i)).join('');

    // ၅ ခုထက်ကျော်ရင် "နောက်ထပ်ဖတ်ရန်" ခလုတ်ထည့်မယ်
    if (hasMore) {
        html += `
        <div id="more-btn-${postId}" onclick="showAllComments('${postId}')" style="color:purple; font-size:12px; cursor:pointer; font-weight:bold; margin-top:5px; padding:5px;">
            💬 နောက်ထပ်မှတ်ချက် ${hiddenComments.length} ခုကို ဖတ်ရန်...
        </div>
        <div id="extra-comms-${postId}" style="display:none;">
            ${hiddenComments.map((c, i) => generateCommentHTML(c, i, true)).join('')}
        </div>`;
    }

    return html;
}
window.showAllComments = function(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    if (extra && btn) {
        extra.style.display = "block";
        btn.style.display = "none";
    }
};


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
    
    const btn = event.currentTarget;
    const countSpan = btn.querySelector(type === 'likes' ? '.like-count' : '.haha-count');
    let currentCount = parseInt(countSpan?.innerText || 0);
    const uid = auth.currentUser.uid;
    
    // UI Update (Optimistic)
    const isActive = btn.style.color === 'blue' || btn.style.color === 'orange';
    btn.style.color = isActive ? 'gray' : (type === 'likes' ? 'blue' : 'orange');
    if (countSpan) countSpan.innerText = isActive ? Math.max(0, currentCount - 1) : currentCount + 1;

    const ref = db.collection("health_posts").doc(id);
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    try {
        const snap = await ref.get();
        const d = snap.data();
        const hasReacted = d[field]?.includes(uid);

        await ref.update({
            [field]: hasReacted ? firebase.firestore.FieldValue.arrayRemove(uid) : firebase.firestore.FieldValue.arrayUnion(uid),
            [countField]: firebase.firestore.FieldValue.increment(hasReacted ? -1 : 1)
        });
    } catch (e) {
        console.error("React error:", e);
        // Error ဖြစ်ရင် UI ကို မူလအတိုင်း ပြန်ပြင်ဖို့ လိုပါမယ်
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
    
    try {
        const ref = db.collection("health_posts").doc(postId);
        const snap = await ref.get();
        if (!snap.exists) return;

        let comments = [...snap.data().comments];
        
        // Array ထဲကနေ ရွေးထားတဲ့ index ကို ဖယ်ထုတ်
        comments.splice(index, 1);
        
        // Firestore မှာ Update ပြန်လုပ်
        await ref.update({ comments: comments });

        // UI ကို ချက်ချင်း Update လုပ်ဖို့ (ဒါမှ ဖျက်လိုက်တာ ချက်ချင်းပျောက်မှာပါ)
        const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;
        const uid = auth.currentUser?.uid;
        const commsContainer = document.getElementById(`comms-${postId}`);
        if (commsContainer) {
            commsContainer.innerHTML = renderComments(postId, comments, isAdmin, uid);
        }
        
        alert("ဖျက်ပြီးပါပြီ Senior");
    } catch (error) {
        console.error("Delete comment error:", error);
        alert("ဖျက်လို့မရပါဘူး Senior");
    }
}


async function togglePin(id, current) { 
    try {
        // ၁။ Firestore မှာ Pin Status ကို ပြောင်းလဲခြင်း
        await db.collection("health_posts").doc(id).update({ 
            isPinned: !current 
        }); 

        // ၂။ UI မှာ ပို့စ်တွေကို ချက်ချင်း အစီအစဉ်ပြန်စီရန် (Pin ပို့စ် အပေါ်ရောက်သွားအောင်)
        if (typeof loadPosts === 'function') {
            loadPosts('health_posts'); 
        } else {
            location.reload();
        }

        // ၃။ အောင်မြင်ကြောင်း အသိပေးချက် (Optional)
        const msg = !current ? "ပို့စ်ကို Pin ထိုးလိုက်ပါပြီ" : "Pin ကို ဖြုတ်လိုက်ပါပြီ";
        console.log(msg);

    } catch (e) {
        console.error("Pin error:", e);
        alert("Pin လုပ်လို့မရပါဘူး Senior");
    }
}
async function incrementView(id) {
    // ဒီ Post ကို ဒီ Device မှာ ကြည့်ဖူးလား စစ်မယ်
    const viewedPosts = JSON.parse(localStorage.getItem('viewed_posts') || '{}');
    
    if (viewedPosts[id]) {
        return; // ကြည့်ဖူးရင် ဘာမှမလုပ်တော့ဘူး
    }

    try {
        await db.collection("health_posts").doc(id).update({
            views: firebase.firestore.FieldValue.increment(1)
        });
        
        // ကြည့်ပြီးကြောင်း မှတ်သားထားမယ်
        viewedPosts[id] = true;
        localStorage.setItem('viewed_posts', JSON.stringify(viewedPosts));
        
        console.log("View count increased for unique device");
    } catch (e) {
        console.error("View increment error:", e);
    }
}
async function handleShare(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    try {
        const ref = db.collection("health_posts").doc(id);
        const snap = await ref.get();
        if (!snap.exists) return alert("မူရင်း Post မရှိတော့ပါဘူး Senior");
        const d = snap.data();

        // မူရင်း Post ရဲ့ Share count ကို တိုးမယ်
        await ref.update({ shares: firebase.firestore.FieldValue.increment(1) });

        // News Feed ထဲ မထည့်တော့ဘဲ 'shares' collection ထဲမှာ သီးသန့်သိမ်းမယ်
        await db.collection("shares").add({
            ...d,
            originalPostId: id, // မူရင်း ID ကို မှတ်ထားမယ် (ဖျက်ရင် သုံးဖို့)
            sharedByUid: auth.currentUser.uid,
            sharedByName: auth.currentUser.displayName,
            author: `${d.author} (Shared by ${auth.currentUser.displayName})`,
            likes: 0, likedBy: [], 
            hahas: 0, hahaedBy: [], 
            comments: [], 
            shares: 0,
            views: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("သင့် Profile မှာ Share လိုက်ပါပြီ Senior!");
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
    const nameElement = document.getElementById('setupUserName');
    if (!nameElement) return;

    const user = auth.currentUser;
    if (!user) {
        alert("ကျေးဇူးပြု၍ Login အရင်ဝင်ပါ။");
        if (typeof showPhoneLogin === 'function') showPhoneLogin();
        return;
    }

    let inputName = nameElement.value.trim();
    
    if (!inputName) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("အမည်ထည့်သွင်းပေးပါ။");
    }
    
    if (inputName.length < 2) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("အမည်သည် အနည်းဆုံး ၂ လုံး ရှိရပါမည်။");
    }
    
    // --- ပြင်ဆင်ချက် ၁။ အများဆုံး စာလုံးရေ ၁၂ လုံး သတ်မှတ်ခြင်း ---
    if (inputName.length > 12) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("Senior ရေ... အမည်ကို အများဆုံး ၁၂ လုံးသာ ခွင့်ပြုထားပါတယ်ခင်ဗျာ။");
    }
    
    if (!isSafeName(inputName)) {
        nameElement.style.border = "2px solid red";
        nameElement.focus();
        return alert("မြန်မာစာ၊ အင်္ဂလိပ်စာနဲ့ ဂဏန်းများသာ ထည့်နိုင်ပါသည်။");
    }

    const saveButton = nameElement.nextElementSibling || document.querySelector('#nameSetupModal button');
    const originalButtonText = saveButton ? saveButton.innerText : "အတည်ပြုမည်";
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerText = "စစ်ဆေးနေသည်...";
    }

    try {
        // --- ပြင်ဆင်ချက် ၂။ နာမည်တူနေလျှင် နံပါတ်စဉ် အလိုအလျောက် ကပ်ပေးသည့် Logic ---
        let finalDisplayName = inputName;
        
        // Database မှာ နာမည်တူ ရှိမရှိ စစ်မယ်
        const existingUserQuery = await db.collection("users")
            .where("displayName", "==", inputName)
            .limit(1)
            .get();
        
        // တကယ်လို့ နာမည်တူရှိနေရင် (ပြီးတော့ အဲဒီလူက ကိုယ်ကိုယ်တိုင် မဟုတ်ရင်)
        if (!existingUserQuery.empty && existingUserQuery.docs[0].id !== user.uid) {
            // Random နံပါတ် ၄ လုံး (သို့မဟုတ်) Timestamp ရဲ့ နောက်ဆုံး ဂဏန်းများကို သုံးနိုင်ပါတယ်
            const randomSuffix = Math.floor(1000 + Math.random() * 9000); 
            finalDisplayName = `${inputName}_${randomSuffix}`;
            
            // စာလုံးရေ ၁၂ လုံးထက် မကျော်အောင် ပြန်ညှိပေးခြင်း (Optional)
            if (finalDisplayName.length > 15) { 
                // နံပါတ်ကပ်လိုက်လို့ အရမ်းရှည်သွားရင် ရှေ့က နာမည်ကို နည်းနည်း ဖြတ်ထုတ်ပါမယ်
                finalDisplayName = `${inputName.substring(0, 8)}_${randomSuffix}`;
            }
            
            console.log(`⚠️ Name duplicate found. Auto-assigned: ${finalDisplayName}`);
        }

        if (saveButton) saveButton.innerText = "သိမ်းဆည်းနေသည်...";

        // Firebase Auth Profile Update
        await user.updateProfile({ 
            displayName: finalDisplayName 
        });

        // Firestore Database Update
        await db.collection("users").doc(user.uid).set({
            displayName: finalDisplayName,
            isProfileSetup: true,
            setupCompletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // UI Update
        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) {
            userNameDisplay.innerText = finalDisplayName;
        }

        const modal = document.getElementById('nameSetupModal');
        if (modal) {
            modal.style.display = 'none';
        }


        if (typeof showToastMessage === 'function') {
            showToastMessage(`အမည်ကို "${finalDisplayName}" အဖြစ် သိမ်းဆည်းလိုက်ပါပြီ။`, "success");
        } else {
            alert(`အမည်ကို "${finalDisplayName}" အဖြစ် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`);
        }
            } catch (error) {
        console.error("❌ Error saving name:", error);
        alert("နာမည်သိမ်းဆည်းခြင်း မအောင်မြင်ပါ။ " + (error.message || ""));
        nameElement.style.border = "2px solid red";
        nameElement.focus();
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerText = originalButtonText;
        }
        if (nameElement && !nameElement.style.border.includes('red')) {
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
    
// Senior ရဲ့ Logo Link ကို အသုံးပြုထားပါတယ်
const myIcon = auth.currentUser.photoURL || 'https://i.ibb.co/Xx3yHt2y/lastlogo.png';
const myUid = auth.currentUser.uid;
const myName = auth.currentUser.displayName || "User";

    
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
function getDisplayNameWithBadge(d) {

    const badges = [];

    if (d.isCrown) {
        badges.push(`<span class="badge-official crown-bg">👑 Crown</span>`);
    }

    if (d.isGold) {
        badges.push(`<span class="badge-official gold-bg">💰 Gold</span>`);
    }

    return `${d.author || "User"} ${badges.join(" ")}`;
}

// Variable တွေကို တစ်ခါပဲ ကြေညာပါ
var photoList = [];
var currentIndex = 0;

// Photo Viewer ဖွင့်ရန်
window.openPhotoViewer = function(index, photosJson) {
    try {
        // String ကနေ Array ပြန်ပြောင်းတာပါ
        photoList = JSON.parse(decodeURIComponent(photosJson));
        currentIndex = index;

        const viewer = document.getElementById("photoViewer");
        const img = document.getElementById("activeImg");

        if (viewer && img) {
            viewer.style.display = "flex";
            img.src = photoList[currentIndex];
            updatePhotoCount();
        }
    } catch (e) {
        console.error("Photo Viewer Error:", e);
    }
};

// ပုံပြောင်းရန် (Next/Prev)
window.changeSlide = function(direction) {
    if (!photoList || photoList.length === 0) return;

    currentIndex += direction;
    if (currentIndex < 0) currentIndex = photoList.length - 1;
    if (currentIndex >= photoList.length) currentIndex = 0;

    document.getElementById("activeImg").src = photoList[currentIndex];
    updatePhotoCount();
};

function updatePhotoCount() {
    const count = document.getElementById("photoCount");
    if (count) {
        count.innerText = (currentIndex + 1) + " / " + photoList.length;
    }
}

window.closePhotoViewer = function() {
    document.getElementById("photoViewer").style.display = "none";
};
function attachImageViewer(container) {
    if (!container) return;
    
    const imgs = container.querySelectorAll("img");
    const imageUrls = [];
    
    // ပုံအားလုံးရဲ့ URL ကို စုမယ်
    imgs.forEach(img => imageUrls.push(img.src));

    const photosJson = encodeURIComponent(JSON.stringify(imageUrls));

    imgs.forEach((img, index) => {
        // အရင်ရှိပြီးသား onclick ကို ဖျက်ပြီး အသစ်ထည့်တာပါ
        img.onclick = function(e) {
            e.stopPropagation(); // Card ရဲ့ တခြား click event တွေနဲ့ မငြိအောင်
            window.openPhotoViewer(index, photosJson);
        };
    });
}
window.toggleText = function(id) {
    const textElement = document.getElementById(`text-${id}`);
    const btnElement = document.getElementById(`btn-${id}`);
    
    if (textElement && btnElement) {
        if (textElement.classList.contains('expanded')) {
            textElement.classList.remove('expanded');
            btnElement.innerText = "... See More";
            // Comment အတွက်ဆိုရင် line-clamp ပြန်ပိတ်ဖို့
            textElement.style.display = "-webkit-box"; 
        } else {
            textElement.classList.add('expanded');
            btnElement.innerText = " Show Less";
            // စာသားအကုန်မြင်ရအောင် box style ကို ဖြုတ်ပေးတာပါ
            textElement.style.display = "block"; 
        }
    }
};

// Post အသစ်တွေ load လုပ်ပြီးတိုင်း ဒါကို ခေါ်ပေးရပါမယ်
function observePosts() {
    const posts = document.querySelectorAll('.post-card');
    posts.forEach(post => postViewObserver.observe(post));
}
window.videoObserver = videoObserver;
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
{
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
cleanupPosts,
    refreshPosts,
    lastVisiblePost,
    isFetching
};

Object.assign(window, postActions, postLoading);

console.log("Script loaded successfully!");

})();
