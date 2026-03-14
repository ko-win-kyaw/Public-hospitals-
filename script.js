(function() {
   // --- Global Queues ---
let reactionQueue = JSON.parse(localStorage.getItem('pending_reactions') || '[]');
let commentQueue = JSON.parse(localStorage.getItem('pending_comments') || '[]');
let shareQueue = JSON.parse(localStorage.getItem('pending_shares') || '[]');
let viewQueue = JSON.parse(localStorage.getItem('view_queue') || '{}');

// Notification အတွက် Queue အသစ်
let notifQueue = JSON.parse(localStorage.getItem('pending_notifications') || '[]');
    let currentUserData = null; 
    let lastVisiblePost = null;
    let isFetching = false;
    let fpAgent = null;
    var photoList = [];
    var currentIndex = 0;

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

// Global variable အနေနဲ့ အစမှာ တစ်ခါတည်း ကြေညာထားပါ (Share logic က သုံးဖို့)
window.allPosts = [];

async function loadPosts(collectionName = "health_posts") {
    const cacheKey = "cached_posts_" + collectionName;
    const cacheTimeKey = "cached_posts_time_" + collectionName;
    const postsContainer = document.getElementById('newsFeed');
    if (!postsContainer) return;

    try {
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;
        const isAdmin = auth.currentUser ? (auth.currentUser.email === ADMIN_EMAIL) : false;

        // ---------- LOAD FROM CACHE ----------
        if (cachedData && cachedTime && (Date.now() - cachedTime < 300000)) {
            const posts = JSON.parse(cachedData);
            
            // Share logic အတွက် Cache က data တွေကိုပါ window object ထဲ ထည့်ပေးမယ်
            window.allPosts = posts.map(p => ({ id: p.id, ...p.data }));

            let html = "";
            posts.forEach(p => {
                html += renderPostHTML(p.id, p.data, currentUid, isAdmin);
            });

            html += `<div id="scroll-trigger" style="text-align:center; margin:20px;">
                <button onclick="loadMorePosts('${collectionName}')" 
                style="background:purple; color:white; border:none; padding:10px 20px; border-radius:5px;">
                Load More
                </button>
            </div>`;

            postsContainer.innerHTML = html;
            console.log("Loaded posts from cache (and updated window.allPosts)");
            restartObservers();
            return;
        }

        // ---------- FIREBASE FETCH ----------
        postsContainer.innerHTML = '<div style="text-align:center; padding:20px;">⏳ ပို့စ်များ ဖတ်နေသည်...</div>';

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

        let html = "";
        const posts = []; // Local array for caching
        window.allPosts = []; // Global array reset လုပ်မယ် (Share logic အတွက်)

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // ၁။ Cache အတွက် သိမ်းတဲ့ format
            posts.push({
                id: doc.id,
                data: data
            });

            // ၂။ Share Logic က ရှာတွေ့နိုင်အောင် format မှန်အောင် သိမ်းခြင်း
            const postObj = { id: doc.id, ...data };
            window.allPosts.push(postObj);

            // ၃။ UI အတွက် HTML ထုတ်ခြင်း
            html += renderPostHTML(doc.id, data, currentUid, isAdmin);
        });

        html += `<div id="scroll-trigger" style="text-align:center; margin:20px;">
            <button onclick="loadMorePosts('${collectionName}')" 
            style="background:purple; color:white; border:none; padding:10px 20px; border-radius:5px;">
            Load More
            </button>
        </div>`;

        postsContainer.innerHTML = html;

        // ---------- SAVE CACHE ----------
        localStorage.setItem(cacheKey, JSON.stringify(posts));
        localStorage.setItem(cacheTimeKey, Date.now());

        restartObservers();

    } catch (error) {
        console.error("Load posts error:", error);
        postsContainer.innerHTML = `❌ Error: ${error.message}`;
    }
}
/**
 * Notification များကို Batch System ထဲသို့ ထည့်သွင်းပေးသည့် Function
 * @param {string} receiverId - လက်ခံမည့်သူ၏ UID
 * @param {string} title - အကြောင်းကြားစာ ခေါင်းစဉ်
 * @param {string} body - အကြောင်းကြားစာ အသေးစိတ်
 * @param {string|null} postId - (Optional) နှိပ်လိုက်လျှင် သွားရမည့် Post ID
 */
function queueNotification(receiverId, title, body, postId = null) {
    // ၁။ ကိုယ့်ကိုယ်ကို ပြန်ပို့တာဆိုရင် သို့မဟုတ် လက်ခံမည့်သူ မရှိရင် ရပ်မယ်
    if (!receiverId || receiverId === auth.currentUser.uid) return; 

    // ၂။ Notification Object တည်ဆောက်ခြင်း
    const notifData = {
        receiverId: receiverId,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || "User",
        title: title,
        body: body,
        postId: postId, // postId ပါရင် ပါမယ်၊ မပါရင် null ဖြစ်နေမယ်
        status: "unread",
        // Client-side timestamp (batch sync မှာ server timestamp နဲ့ အစားထိုးမယ်)
        tempTime: Date.now() 
    };

    // ၃။ Queue ထဲသို့ ထည့်သွင်းခြင်း
    notifQueue.push(notifData);

    // ၄။ LocalStorage တွင် Backup သိမ်းဆည်းခြင်း
    localStorage.setItem('pending_notifications', JSON.stringify(notifQueue));
    
    console.log(`📌 Notification queued for ${receiverId}: ${title}`);
}

// ---------- OBSERVER RESTART ----------
function restartObservers(){

    setTimeout(()=>{

        document.querySelectorAll('video').forEach(v=>{
            v.muted = true;
            v.setAttribute('playsinline','');
            if(window.videoObserver) window.videoObserver.observe(v);
        });

        document.querySelectorAll('.post-card').forEach(p=>{
            if(window.postViewObserver) window.postViewObserver.observe(p);
        });

    },800);
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

    // ၁။ ဒီမှာတင် originalIndex ကို တစ်ခါတည်း သတ်မှတ်လိုက်တာ အကောင်းဆုံးပါ
    const sortedComments = comments
        .map((c, i) => ({ ...c, originalIndex: i })) 
        .sort((a, b) => ((b.likes || 0) + (b.hahas || 0)) - ((a.likes || 0) + (a.hahas || 0)));

    const limit = 5;
    const hasMore = sortedComments.length > limit;
    
    const displayedComments = sortedComments.slice(0, limit);
    const hiddenComments = sortedComments.slice(limit);

    const generateCommentHTML = (c, index, isHiddenPart = false) => {
        // ၂။ ပြင်ဆင်ချက်: comments.indexOf(c) အစား c.originalIndex ကို တိုက်ရိုက်သုံးပါ
        const originalIndex = c.originalIndex; 
        
        const commId = `${postId}-comm-${isHiddenPart ? 'extra-' : ''}${index}`;
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
        const userData = currentUserData || {}; 
        const isPremium = userData.isCrown === true || userData.isGold === true;

        const maxFiles = isPremium ? 10 : 1;
        const maxVideoSize = isPremium ? 60 * 1024 * 1024 : 20 * 1024 * 1024;

        if (files.length > maxFiles) return alert(`သင့်အဆင့်အတန်းအရ တစ်ခါတင်ရင် ${maxFiles} ဖိုင်သာ ခွင့်ပြုပါတယ်!`);
        if (!text && files.length === 0) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ");

        btn.disabled = true;
        btn.innerText = "တင်နေသည်...";

        let mediaUrls = [];
        let mediaType = "";

        // --- Media Upload Logic ---
        for (let file of files) {
            const isVideo = file.type.startsWith('video/');
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

            if (isVideo) {
                // ဗီဒီယိုဖြစ်ခဲ့ရင် Size စစ်မယ်
                if (file.size > maxVideoSize) throw new Error(`ဗီဒီယိုဆိုဒ် ${isPremium ? '60MB' : '20MB'} ထက် ကျော်နေပါတယ်`);
                
                // Bunny Storage သို့ တင်ခြင်း
                const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { 
                    method: 'PUT', 
                    headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: file
                });

                if (res.ok) {
                    mediaUrls = [`https://public-hospitals.b-cdn.net/${fileName}`]; // ဗီဒီယိုဆိုရင် array ကို reset လုပ်ပြီး သူတစ်ခုပဲ ထည့်မယ်
                    mediaType = 'video';
                    break; // ဗီဒီယိုတစ်ခု တင်ပြီးတာနဲ့ loop ကို ရပ်လိုက်မယ် (ဓာတ်ပုံတွေပါရင်လည်း ဆက်မတင်တော့ဘူး)
                }
            } else {
                // ဓာတ်ပုံဖြစ်ခဲ့ရင် (ဗီဒီယို မဟုတ်မှသာ ဒီထဲရောက်မယ်)
                mediaType = 'image';
                const fd = new FormData();
                fd.append('image', file);
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) mediaUrls.push(data.data.url);
            }
        }

        // Firestore ထဲသို့ Post အသစ်ထည့်ခြင်း
        await db.collection("health_posts").add({
            author: auth.currentUser.displayName || "User",
            uid: auth.currentUser.uid,
            text: text,
            mediaUrls: mediaUrls,
            mediaType: mediaType,
            isCrown: userData.isCrown || false,
            isGold: userData.isGold || false,
            likes: 0, 
            hahas: 0,
            views: 0, 
            shares: 0,
            likedBy: [], 
            hahaedBy: [], 
            comments: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // UI Reset Logic
        document.getElementById('postContent').value = "";
        fileInput.value = "";
        if(document.getElementById('mediaPreviewBox')) {
            document.getElementById('mediaPreviewBox').style.display = 'none';
            document.getElementById('mediaPreviewBox').innerHTML = '';
        }
        alert("တင်ပြီးပါပြီ Senior!");
        
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

    // လက်ရှိ status ကို စစ်ဆေးခြင်း
    const isBlue = btn.style.color === 'blue';
    const isOrange = btn.style.color === 'orange';
    const isActive = (type === 'likes' && isBlue) || (type === 'hahas' && isOrange);

    // --- STEP 1: UI Update (Optimistic) ---
    // အရောင်ပြောင်းမယ်
    btn.style.color = isActive ? 'gray' : (type === 'likes' ? 'blue' : 'orange');
    
    // Count ပြောင်းမယ်
    if (countSpan) {
        countSpan.innerText = isActive ? Math.max(0, currentCount - 1) : currentCount + 1;
    }

    // --- STEP 2: Queue ထဲသို့ ထည့်ခြင်း ---
    // တူညီတဲ့ postId နဲ့ type အတွက် queue ထဲမှာ ရှိပြီးသားဆိုရင် (ဥပမာ- like ပေးပြီး ချက်ချင်းပြန်ဖြုတ်ရင်) 
    // အဲဒီ data နှစ်ခုလုံးကို ဖယ်လိုက်လို့ရပါတယ် (Database သွားစရာမလိုတော့လို့ Bill ပိုသက်သာပါတယ်)
    const existingIndex = reactionQueue.findIndex(r => r.postId === id && r.type === type);

    if (existingIndex > -1) {
        reactionQueue.splice(existingIndex, 1);
    } else {
        reactionQueue.push({
            postId: id,
            type: type,
            action: isActive ? 'remove' : 'add',
            uid: uid,
            timestamp: Date.now()
        });
    }

    // LocalStorage မှာ ခေတ္တသိမ်းထားမယ်
    localStorage.setItem('pending_reactions', JSON.stringify(reactionQueue));
}

async function reactComment(postId, originalIndex, type) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    const ref = db.collection("health_posts").doc(postId);
    
    try {
        const snap = await ref.get();
        if (!snap.exists) return;
        
        let comments = [...snap.data().comments];
        let c = comments[originalIndex]; 
        if (!c) return;

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

        await ref.update({ comments });

        // UI Refresh
        const isAdmin = auth.currentUser.email === ADMIN_EMAIL;
        document.getElementById(`comms-${postId}`).innerHTML = renderComments(postId, comments, isAdmin, uid);

        // --- Notification ကို Batch ထဲ ထည့်သွင်းခြင်း ---
        if (isAddingReaction && c.uid && c.uid !== uid) {
            const reactionName = type === 'likes' ? "Like 👍" : "Haha 😆";
            queueNotification(
                c.uid, 
                "Reaction အသစ်ရှိပါသည်", 
                `${auth.currentUser.displayName || "User"} က သင်၏ Comment ကို ${reactionName} ပေးလိုက်ပါတယ်`,
                postId
            );
        }
    } catch (e) {
        console.error("Comment react error:", e);
    }
}


async function addComment(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ");
    
    const inputField = document.getElementById(`in-${id}`);
    const val = inputField.value.trim();
    if (!val) return;

    // --- STEP 1: User Data ရယူခြင်း (Read Cost သက်သာအောင် Global variable ကနေယူမယ်) ---
    // currentUserData မရှိရင် အခြေခံ data နဲ့ပဲသွားမယ်
    const userData = currentUserData || {};
    
    const newComment = {
        uid: auth.currentUser.uid,
        author: auth.currentUser.displayName || "User",
        // Badge logic နှစ်ခုလုံး ပါဝင်အောင် ထည့်သွင်းထားပါတယ်
        isCrown: userData.isCrown || false,
        isGold: userData.isGold || false,
        text: val,
        likes: 0,
        likedBy: [],
        hahas: 0,
        hahaedBy: [],
        createdAt: Date.now(),
        tempId: Date.now() // UI key အတွက်
    };

    // --- STEP 2: UI Update (Optimistic UI - ချက်ချင်းပြမယ်) ---
    try {
        const commContainer = document.getElementById(`comms-${id}`);
        const isAdmin = auth.currentUser.email === ADMIN_EMAIL;
        
        // renderComments ကိုသုံးပြီး UI မှာ comment အသစ်ကို ချက်ချင်း append လုပ်မယ်
        const tempHtml = renderComments(id, [newComment], isAdmin, auth.currentUser.uid);
        commContainer.insertAdjacentHTML('beforeend', tempHtml);
        
        // Input ကို ချက်ချင်းရှင်းမယ်
        inputField.value = "";
        
        // စာမျက်နှာအောက်ဆုံးကို scroll ဆွဲပေးမယ် (Optional)
        commContainer.scrollTop = commContainer.scrollHeight;

    } catch (uiError) {
        console.error("UI Update Error:", uiError);
    }

    // --- STEP 3: Queue ထဲသို့ ထည့်ခြင်း (၅ မိနစ်နေမှ Database သွားမယ်) ---
    commentQueue.push({
        postId: id,
        commentData: newComment
    });
    
    // Refresh ဖြစ်သွားရင် data မပျောက်အောင် LocalStorage မှာ သိမ်းမယ်
    localStorage.setItem('pending_comments', JSON.stringify(commentQueue));
}
async function deleteComment(postId, originalIndex) {
    // ၁။ confirm မေးခွန်း မေးခြင်း (confirm keyword သည် lowercase ဖြစ်ရပါမည်)
    if (!confirm("ဒီမှတ်ချက်ကို ဖျက်မှာ သေချာလား Senior?")) return;
    
    try {
        const ref = db.collection("health_posts").doc(postId);
        
        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(ref);
            if (!snap.exists) return;

            let comments = [...snap.data().comments];
            
            if (originalIndex > -1 && originalIndex < comments.length) {
                comments.splice(originalIndex, 1); 
                transaction.update(ref, { comments: comments });
            }
        });

        // ၂။ UI Update Logic
        const finalSnap = await ref.get();
        const updatedData = finalSnap.data();
        const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;
        const uid = auth.currentUser?.uid;
        
        const commContainer = document.getElementById(`comms-${postId}`);
        if (commContainer) {
            commContainer.innerHTML = renderComments(postId, updatedData.comments, isAdmin, uid);
        }
        
        alert("ဖျက်ပြီးပါပြီ Senior");
    } catch (error) {
        console.error("Delete comment error:", error);
        alert("ဖျက်လို့မရပါဘူး Senior: " + error.message);
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
// ---------- REGISTER VIEW ----------
function incrementView(postId) {

    // device မှာ ဒီ post ကြည့်ပြီးသားလား
    const viewedPosts = JSON.parse(localStorage.getItem('viewed_posts') || '{}');

    if (viewedPosts[postId]) {
        return;
    }

    // viewed mark
    viewedPosts[postId] = true;
    localStorage.setItem('viewed_posts', JSON.stringify(viewedPosts));

    // queue ထဲထည့်
    if (!viewQueue[postId]) {
        viewQueue[postId] = 0;
    }

    viewQueue[postId]++;

    localStorage.setItem("view_queue", JSON.stringify(viewQueue));
}
async function handleShare(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    // UI မှာ Share Count ကို ချက်ချင်းတိုးပြမယ်
    const shareCountElement = document.querySelector(`[data-id="${id}"] .share-count-text`); 
    if(shareCountElement) {
        let current = parseInt(shareCountElement.innerText.match(/\d+/) || 0);
        shareCountElement.innerText = `🚀 Share (${current + 1})`;
    }

    try {
        // မူရင်း Post Data ကို Cache ထဲကဖြစ်ဖြစ်၊ UI ကဖြစ်ဖြစ် ရယူမယ် (Read Cost သက်သာအောင်)
        const postElement = document.querySelector(`[data-id="${id}"]`);
        // မှတ်ချက် - Senior ရဲ့ loadPosts မှာ data တွေကို variable တစ်ခုခုထဲ သိမ်းထားရင် ပိုကောင်းပါတယ်
        const originalPostData = allPosts.find(p => p.id === id) || {}; 

        if (!originalPostData.author) {
             return alert("မူရင်း Post အချက်အလက် ရှာမတွေ့ပါဘူး Senior");
        }

        // --- Queue ထဲသို့ Share လုပ်မည့် Data များ ထည့်ခြင်း ---
        shareQueue.push({
            postId: id, // မူရင်း ID (Share count တိုးဖို့)
            uid: auth.currentUser.uid,
            // Share Post အသစ်အတွက် လိုအပ်တဲ့ data များ
            newShareData: {
                ...originalPostData,
                id: null, // ID အသစ်ဖြစ်သွားမှာမို့လို့
                originalPostId: id,
                sharedByUid: auth.currentUser.uid,
                sharedByName: auth.currentUser.displayName,
                author: `${originalPostData.author} (Shared by ${auth.currentUser.displayName})`,
                likes: 0, likedBy: [], 
                hahas: 0, hahaedBy: [], 
                comments: [], 
                shares: 0,
                views: 0,
                createdAt: Date.now() // Sync လုပ်တဲ့အချိန်မှ ServerTimestamp ပြောင်းမယ်
            }
        });

        // LocalStorage မှာ သိမ်းထားမယ်
        localStorage.setItem('pending_shares', JSON.stringify(shareQueue));
        
        alert("သင့် Profile မှာ Share လိုက်ပါပြီ (Syncing...) Senior!");
    } catch (e) {
        alert("Share လုပ်ရာမှာ အမှားအယွင်းရှိပါတယ် Senior");
        console.error(e);
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
    
    // ၁။ Logo link ကို သေချာသတ်မှတ်မယ် (Senior ပေးထားတဲ့ link)
    const defaultLogo = 'https://i.ibb.co/Xx3yHt2y/lastlogo.png';
    // User မှာ ပုံရှိရင် သူ့ပုံပြမယ်၊ မရှိရင် Senior ပေးတဲ့ logo ပြမယ်
    const myIcon = auth.currentUser.photoURL || defaultLogo;
    
    const myUid = auth.currentUser.uid;

    db.collection("notifications")
        .where("receiverId", "==", myUid)
        .where("status", "==", "unread")
        .onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                if (change.type === "added") {
                    const notif = change.doc.data();
                    const notifId = change.doc.id;
                    
                    if (Notification.permission === "granted") {
                        const n = new Notification(notif.title || "အသိပေးချက်", {
                            body: notif.body || "",
                            icon: myIcon, // ဒီမှာ logo ပြမှာပါ
                            badge: defaultLogo, // Android ဖုန်းတွေရဲ့ status bar မှာ ပြမယ့် logo
                            data: { postId: notif.postId }
                        });

                        n.onclick = function(e) {
                            e.preventDefault();
                            window.focus();

                            if (this.data.postId) {
                                const targetPost = document.querySelector(`[data-id="${this.data.postId}"]`);
                                if (targetPost) {
                                    targetPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    targetPost.style.transition = "background 0.5s";
                                    targetPost.style.background = "#fff9c4";
                                    setTimeout(() => targetPost.style.background = "white", 2000);
                                }
                            }
                            n.close();
                        };
                    }
                    
                    // ပြပြီးရင် Read အဖြစ် ပြောင်းမယ်
                    db.collection("notifications").doc(notifId).update({ status: "read" });
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
    const userNameDisplay = document.getElementById('userNameDisplay');
    const modal = document.getElementById('nameSetupModal');
    
    if (userNameDisplay) {
        userNameDisplay.innerText = user?.displayName || 'Guest';
    }
    
    if (!user) {
        currentUserData = null; // Logout ဖြစ်ရင် data ဖျက်မယ်
        return;
    }

    try {
        const currentDevId = await Promise.race([
            getMyDeviceId(),
            new Promise(resolve => setTimeout(() => resolve("timeout_id"), 5000))
        ]);

        const isBanned = await checkBanStatus(user.uid, currentDevId);
        if (isBanned) {
            await auth.signOut();
            return;
        }

        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();
        
        // --- ပြင်ဆင်ချက်- ရလာတဲ့ data ကို global variable ထဲ ထည့်သိမ်းမယ် ---
        currentUserData = doc.exists ? doc.data() : null;

        if (user.email !== ADMIN_EMAIL && currentUserData) {
            if (currentDevId !== "timeout_id" && 
                currentUserData.deviceId && 
                currentUserData.deviceId !== currentDevId) {
                alert("Account Error: Device Lock အလုပ်လုပ်နေပါသည်။");
                await auth.signOut();
                return;
            }
        }

        const hasStoredName = currentUserData && currentUserData.displayName;
        const hasAuthName = user.displayName;

        if (hasStoredName || hasAuthName) {
            if (modal) modal.style.display = 'none';
            if (userNameDisplay) userNameDisplay.innerText = hasStoredName || hasAuthName;
        } else {
            if (modal) modal.style.display = 'flex';
        }

        const updatePayload = {
            uid: user.uid,
            displayName: hasStoredName || hasAuthName || "User",
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (currentDevId !== "timeout_id") {
            updatePayload.deviceId = currentDevId;
        }
        await userRef.set(updatePayload, { merge: true });

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
        badges.push(`<span class="badge-official crown-bg">👑 </span>`);
    }

    if (d.isGold) {
        badges.push(`<span class="badge-official gold-bg">💰</span>`);
    }

    return `${d.author || "User"} ${badges.join(" ")}`;
}
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
setInterval(async () => {
    const viewEntries = Object.entries(viewQueue);
    
    if (reactionQueue.length === 0 && shareQueue.length === 0 && 
        viewEntries.length === 0 && commentQueue.length === 0 && 
        notifQueue.length === 0) return;

    console.log("🔄 Global Batch Syncing (All Activities)...");
    const batch = db.batch();

    // 1. Reactions
    reactionQueue.forEach(item => {
        const ref = db.collection("health_posts").doc(item.postId);
        const f = item.type === 'likes' ? 'likedBy' : 'hahaedBy';
        const cf = item.type === 'likes' ? 'likes' : 'hahas';
        batch.update(ref, {
            [f]: item.action === 'add' ? firebase.firestore.FieldValue.arrayUnion(item.uid) : firebase.firestore.FieldValue.arrayRemove(item.uid),
            [cf]: firebase.firestore.FieldValue.increment(item.action === 'add' ? 1 : -1)
        });
    });

    // 2. Shares
    shareQueue.forEach(item => {
        batch.update(db.collection("health_posts").doc(item.postId), { shares: firebase.firestore.FieldValue.increment(1) });
        const newShareRef = db.collection("shares").doc();
        batch.set(newShareRef, { ...item.newShareData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });

    // 3. Views
    for (const [pid, count] of viewEntries) {
        batch.update(db.collection("health_posts").doc(pid), { views: firebase.firestore.FieldValue.increment(count) });
    }

    // 4. Comments
    commentQueue.forEach(item => {
        batch.update(db.collection("health_posts").doc(item.postId), { comments: firebase.firestore.FieldValue.arrayUnion(item.commentData) });
    });

    // 5. Notifications
    notifQueue.forEach(notifData => {
        const notifRef = db.collection("notifications").doc();
        batch.set(notifRef, {
            ...notifData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    try {
        await batch.commit();
        console.log("✅ Everything synced successfully!");

        // Memory & Storage ရှင်းထုတ်ခြင်း
        reactionQueue = []; commentQueue = []; shareQueue = []; notifQueue = []; viewQueue = {};
        localStorage.removeItem('pending_reactions');
        localStorage.removeItem('pending_comments');
        localStorage.removeItem('pending_shares');
        localStorage.removeItem('view_queue');
        localStorage.removeItem('pending_notifications');
    } catch (e) {
        console.error("❌ Batch Sync Error:", e);
    }
}, 300000);



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

function observePosts() {
    const posts = document.querySelectorAll('.post-card');
    posts.forEach(post => postViewObserver.observe(post));
}
window.allPosts = []; 
window.videoObserver = videoObserver;
window.auth = firebase.auth();
window.db = firebase.firestore();
const postActions = {
    uploadAndPost,
    addComment,
    reactComment,
    deleteComment,
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
