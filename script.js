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
    if (!d) return "Anonymous";
    let badge = "";
    if (d.isCrown === true) {
        badge = ` <span class="badge-official crown-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap;">👑 Official</span>`;
    } else if (d.isGold === true) {
        badge = ` <span class="badge-official gold-bg" style="font-size:10px; padding:2px 5px; vertical-align:middle; white-space:nowrap;">$ Verified</span>`;
    }
    // အမည်ဘေးမှာ Badge ကို တန်းစီပြီး ကပ်ပေးမယ့် Logic ပါ
    return `<span style="display:inline-flex; align-items:center; gap:4px;">${d.author || d.displayName || "User"}${badge}</span>`;
}

async function getMyDeviceId() {
    try {
        // Library ရှိမရှိစစ်ခြင်း
        if (typeof FingerprintJS === 'undefined') {
            console.warn("FingerprintJS library is missing!");
            return "unknown_device_id";
        }
        
        // Fingerprint agent ကို load လုပ်ပြီး ID ယူခြင်း
        const fpPromise = FingerprintJS.load();
        const fp = await fpPromise;
        const result = await fp.get();
        return result.visitorId; // တိကျတဲ့ Device ID ကို return ပြန်ပေးပါမယ်
    } catch (e) { 
        console.error("Fingerprint Error:", e);
        return "error_generating_id"; 
    }
}
// --- ၂။ Video & Scroll Observers ---
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.intersectionRatio < 0.8) {
            video.pause();
        } else {
            video.play().catch(e => console.log("Auto-play blocked"));
        }
    });
}, { threshold: [0.8] });

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-id');
            if (postId && entry.target.getAttribute('data-viewed') !== "true") {
                incrementView(postId);
                entry.target.setAttribute('data-viewed', "true");
                scrollObserver.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.5 });

function observeElements() {
    document.querySelectorAll('video').forEach(v => videoObserver.observe(v));
    document.querySelectorAll('.post-card').forEach(post => scrollObserver.observe(post));
}
auth.onAuthStateChanged(async (user) => {
    console.log("🛠️ Auth Process Start...");
    const nameDisplay = document.getElementById('userNameDisplay');
    const nameModal = document.getElementById('nameSetupModal');
    
    if (user) {
        try {
            // ၁။ Device ID ရယူခြင်း
            const currentDevId = await Promise.race([
                getMyDeviceId(),
                new Promise(resolve => setTimeout(() => resolve("timeout_id"), 5000))
            ]);

            const userRef = db.collection("users").doc(user.uid);
            const doc = await userRef.get();
            const isAdmin = user.email === ADMIN_EMAIL;

            // ၂။ Device Lock စစ်ဆေးခြင်း
            if (doc.exists) {
                const userData = doc.data();
                if (!isAdmin && currentDevId !== "timeout_id" && userData.deviceId && userData.deviceId !== currentDevId) {
                    alert("Account Error: ဤအကောင့်ကို အခြားဖုန်းတွင် သုံးထားပြီးသားဖြစ်သည်။");
                    await auth.signOut();
                    return;
                }
            }

            // --- ၃။ Smart Update Logic (၁ ရက်မှ ၁ ကြိမ်သာ Update လုပ်ရန်) ---
            const today = new Date().toISOString().split('T')[0]; // ဥပမာ "2024-05-20"
            const lastUpdateKey = `last_active_update_${user.uid}`;
            const lastUpdateDate = localStorage.getItem(lastUpdateKey);

            const updatePayload = {
                uid: user.uid,
                displayName: user.displayName || "User_" + user.uid.substring(0,5)
            };

            // Device ID က အသစ်ဖြစ်နေရင် သို့မဟုတ် ဒီနေ့အတွက် update မလုပ်ရသေးရင် Firestore ထဲရေးမယ်
            if (lastUpdateDate !== today || (currentDevId !== "timeout_id" && doc.exists && doc.data().deviceId !== currentDevId)) {
                
                updatePayload.lastActive = firebase.firestore.FieldValue.serverTimestamp();
                if (currentDevId !== "timeout_id") {
                    updatePayload.deviceId = currentDevId;
                }

                await userRef.set(updatePayload, { merge: true });
                localStorage.setItem(lastUpdateKey, today); // Update လုပ်ပြီးကြောင်း မှတ်ထားမယ်
                console.log("✅ Firestore Updated (Daily/New Device)");
            } else {
                console.log("⚡ Skip Update: Already updated today.");
            }
            // -------------------------------------------------------

            // ၄။ Auto Friend System
            if (doc.exists && !doc.data().isAutoFriendAdded) {
                if (typeof startAutoFriendSystem === 'function') await startAutoFriendSystem(user.uid);
            }

            // ၅။ UI အပိုင်း ပြင်ဆင်ခြင်း
            if (!user.displayName || (typeof isSafeName === 'function' && !isSafeName(user.displayName))) {
                if(nameModal) nameModal.style.display = 'flex';
            } else {
                if(nameModal) nameModal.style.display = 'none';
                if(nameDisplay) {
                    const userDataForBadge = doc.exists ? doc.data() : { author: user.displayName };
                    nameDisplay.innerHTML = getDisplayNameWithBadge(userDataForBadge);
                }
            }

            if(typeof startLiveNotifications === 'function') startLiveNotifications();

        } catch (e) {
            console.error("❌ Auth Error:", e);
        }
    } else {
        if (nameDisplay) nameDisplay.innerText = "ဧည့်သည် (Guest)";
    }
    
    if (!window.postsLoaded) { 
        loadPosts(); 
        window.postsLoaded = true; 
    }
});
async function uploadAndPost(collectionName = "health_posts") {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    const text = document.getElementById('postContent').value.trim();
    const fileInput = document.getElementById('mediaInput'); // mediaInput သို့မဟုတ် fileInput ID ကို စစ်ပါ
    const files = fileInput.files;
    const btn = document.getElementById('btnPost');

    if (!text && files.length === 0) return alert("စာ သို့မဟုတ် ဖိုင်ထည့်ပါ Senior");

    try {
        btn.disabled = true; 
        btn.innerText = "တင်နေသည်...";

        // ၁။ User Status စစ်ဆေးခြင်း
        const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        const isPremium = userData.isCrown || userData.isGold;
        
        // ၂။ Limits များ သတ်မှတ်ခြင်း (Premium vs Free)
        const maxVideoSize = isPremium ? 60 * 1024 * 1024 : 20 * 1024 * 1024;
        const maxImages = isPremium ? 10 : 1;

        let mediaUrls = [], mediaType = "text";

        if (files.length > 0) {
            const firstFile = files[0];
            
            // --- ဗီဒီယို တင်သည့်အပိုင်း ---
            if (firstFile.type.startsWith('video/')) {
                if (firstFile.size > maxVideoSize) throw new Error(`ဗီဒီယို ${isPremium ? '60MB' : '20MB'} ထက် မကျော်ရပါ`);
                
                mediaType = 'video';
                const fileName = `${Date.now()}_video_${firstFile.name.replace(/\s+/g, '_')}`;
                
                const res = await fetch(`https://sg.storage.bunnycdn.com/${BUNNY_STORAGE}/${fileName}`, { 
                    method: 'PUT', 
                    headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' },
                    body: firstFile
                });
                if (!res.ok) throw new Error("Bunny.net Upload အဆင်မပြေပါ");
                mediaUrls.push(`https://public-hospitals.b-cdn.net/${fileName}`);
                
            } else {
                // --- ပုံများ တင်သည့်အပိုင်း ---
                mediaType = 'image';
                const uploadLimit = Math.min(files.length, maxImages);
                if (files.length > maxImages) alert(`Senior ရေ... ${maxImages} ပုံပဲ ခွင့်ပြုလို့ ထိပ်ဆုံးပုံတွေပဲ တင်ပေးပါ့မယ်။`);

                for (let i = 0; i < uploadLimit; i++) {
                    const fd = new FormData(); 
                    fd.append('image', files[i]);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.success) mediaUrls.push(data.data.url);
                }
            }
        }

        // ၃။ Firestore သိမ်းဆည်းခြင်း (Dynamic Collection)
        const finalPostData = {
            author: auth.currentUser.displayName || "User",
            uid: auth.currentUser.uid,
            text: text, 
            mediaUrls: mediaUrls,
            mediaType: mediaType,
            isCrown: userData.isCrown || false,
            isGold: userData.isGold || false,
            likes: 0, hahas: 0, views: 0, shares: 0,
            likedBy: [], hahaedBy: [], comments: [],
            isPinned: false,
            // နေရာအလိုက် ID သိမ်းရန် (ဥပမာ Page ID)
            targetId: (typeof targetPageId !== 'undefined') ? targetPageId : auth.currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Pagination အတွက် Server Time သုံးတာ အကောင်းဆုံးပါ
        };

        // Senior ပို့လိုက်တဲ့ Collection နာမည်အတိုင်း သိမ်းမည်
        await db.collection(collectionName).add(finalPostData);

        // UI Reset
        document.getElementById('postContent').value = "";
        fileInput.value = "";
        if(document.getElementById('mediaPreviewBox')) document.getElementById('mediaPreviewBox').style.display = 'none';
        
        alert(`အောင်မြင်စွာ တင်ပြီးပါပြီ Senior! (${collectionName} ထဲသို့)`);

    } catch (e) { 
        alert("Error: " + e.message); 
    } finally { 
        btn.disabled = false; 
        btn.innerText = "တင်မည်"; 
    }
}

let lastVisiblePost = null; // နောက်ဆုံးမြင်ရတဲ့ Post ကို မှတ်ထားရန်
let isFetching = false;    // Load More လုပ်နေတုန်း ထပ်မဆွဲမိစေရန်

// SeniorMaster - loadPosts logic ပြင်ဆင်ချက်
function loadPosts(collectionName = "health_posts") {
    const feed = document.getElementById('newsFeed');
    if (!feed) return;

    // လက်ရှိ collection နာမည်ကို global သိမ်းထားမှ loadMorePosts က သိမှာပါ
    window.currentCollection = collectionName; 

    // သက်ဆိုင်ရာ Collection အလိုက် Query ဆွဲမယ်
    const query = db.collection(collectionName)
                    .orderBy("createdAt", "desc")
                    .limit(20);

    query.onSnapshot(snap => {
        if (snap.empty) {
            if (!feed.hasChildNodes()) {
                feed.innerHTML = "<p style='text-align:center; color:gray; padding:20px;'>Post မရှိသေးပါ။</p>";
            }
            return;
        }

        // Pagination Cursor သတ်မှတ်ချက် (Senior's Original Logic)
        if (!lastVisiblePost) {
            lastVisiblePost = snap.docs[snap.docs.length - 1];
        }

        processChanges(snap.docChanges(), feed);
        
    }, err => {
        console.error("Snapshot Error:", err);
    });

    // ၂။ Infinite Scroll Logic
    window.onscroll = function() {
        const isBottomReached = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 500);
        
        if (isBottomReached && !isFetching && lastVisiblePost) {
            // loadMorePosts ထဲမှာ window.currentCollection ကို သုံးဖို့ လိုပါတယ်
            loadMorePosts(); 
        }
    };
}

// Post အဟောင်းများကို ထပ်မံဆွဲထုတ်ခြင်း (Pagination)
async function loadMorePosts() {
    isFetching = true;
    console.log("🔄 Loading more posts...");
    
    const feed = document.getElementById('newsFeed');
    const moreQuery = db.collection("health_posts")
                        .orderBy("createdAt", "desc")
                        .startAfter(lastVisiblePost)
                        .limit(20);

    try {
        const snap = await moreQuery.get();
        if (snap.empty) {
            lastVisiblePost = null; // ထပ်မရှိတော့ရင် ရပ်မယ်
            console.log("No more posts.");
            return;
        }

        lastVisiblePost = snap.docs[snap.docs.length - 1];
        
        // Pagination ကနေရလာတဲ့ Post တွေကို Render လုပ်မယ်
        snap.docs.forEach(doc => {
            renderSinglePost(doc.id, doc.data(), feed, "append");
        });

    } catch (e) {
        console.error("Load More Error:", e);
    } finally {
        isFetching = false;
    }
}

// Firestore Changes တွေကို ကိုင်တွယ်တဲ့ Logic (နဂို logic အကုန်ပါသည်)
function processChanges(changes, feed) {
    const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
    const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

    changes.forEach(change => {
        const id = change.doc.id;
        const d = change.doc.data();
        let postEl = document.getElementById(`post-${id}`);

        // --- ၁။ Added (Post အသစ်ထည့်ခြင်း) ---
        if (change.type === "added" && !postEl) {
            // Helper Function ကို သုံးပြီး Element ကို တည်ဆောက်မယ်
            // Render လုပ်တဲ့ logic ကို renderSinglePost ထဲမှာ သီးသန့်ထားတာက ပိုသန့်ရှင်းပါတယ်
            const div = createPostElement(id, d, uid, isAdmin);

            // Smart Insertion Logic: Pinned Post တွေကို အမြဲအပေါ်ထားမယ်
            if (d.isPinned) {
                feed.prepend(div); // Pin ထားရင် အပေါ်ဆုံးကို ပို့
            } else {
                // Pin မဟုတ်ရင် "Pinned မဟုတ်တဲ့ ပထမဆုံး Post" ကို ရှာပြီး အဲဒီအရှေ့မှာ ညှပ်ထည့်
                const firstNonPinned = feed.querySelector('.post-card:not([style*="purple"])');
                if (firstNonPinned) {
                    feed.insertBefore(div, firstNonPinned);
                } else {
                    feed.appendChild(div); // Pin Post ပဲရှိနေရင် အောက်ဆုံးကကပ်
                }
            }
        } 
        // --- ၂။ Modified (Like, Comment, Pin Status ပြောင်းလဲခြင်း) ---
        else if (change.type === "modified" && postEl) {
            // Pin Status ပြောင်းသွားရင် (ဥပမာ- Admin က အခုမှ Pin လိုက်ရင်)
            const wasPinned = postEl.style.border.includes("purple");
            const isNowPinned = d.isPinned === true;

            if (wasPinned !== isNowPinned) {
                // Pin အခြေအနေ ပြောင်းသွားရင် Element ကို ဖျက်ပြီး နေရာအမှန်မှာ ပြန်တင်ပေးရပါမယ်
                postEl.remove();
                const newDiv = createPostElement(id, d, uid, isAdmin);
                if (isNowPinned) {
                    feed.prepend(newDiv);
                } else {
                    const firstNonPinned = feed.querySelector('.post-card:not([style*="purple"])');
                    firstNonPinned ? feed.insertBefore(newDiv, firstNonPinned) : feed.appendChild(newDiv);
                }
            } else {
                // Pin Status မပြောင်းဘဲ Like/Comment ပဲ တက်တာဆိုရင် UI ပဲ Update လုပ်မယ်
                updatePostUI(postEl, id, d, uid, isAdmin);
            }
        } 
        // --- ၃။ Removed (Post ဖျက်လိုက်ခြင်း) ---
        else if (change.type === "removed" && postEl) {
            postEl.remove();
        }
    });

    // Intersection Observer ပြန်ချိတ်ပေးခြင်း (Auto-play & View Count အတွက်)
    if (typeof observeElements === "function") observeElements();
}

/**
 * Senior အတွက် Render Logic ကို သီးသန့် Helper Function ခွဲထုတ်လိုက်ပါတယ်
 * ဒါမှ processChanges က ဖတ်ရတာ ပိုရှင်းသွားမှာပါ
 */
function createPostElement(id, d, uid, isAdmin) {
    const div = document.createElement('div');
    div.id = `post-${id}`;
    div.className = "post-card";
    div.setAttribute('data-id', id);
    
    // Pinned Logic အရောင်သတ်မှတ်ချက်
    div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; border:${d.isPinned ? '2px solid purple' : '1px solid #eee'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);`;
    
    div.innerHTML = renderPostHTML(id, d, uid, isAdmin);
    return div;
}

// Post တစ်ခုချင်းစီကို HTML ထည့်ပေးတဲ့ Helper Function
function renderSinglePost(id, d, feed, position) {
    const uid = auth.currentUser ? auth.currentUser.uid : "visitor";
    const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

    const div = document.createElement('div');
    div.id = `post-${id}`;
    div.className = "post-card";
    div.setAttribute('data-id', id);
    div.style = `background:white; margin-bottom:15px; padding:15px; border-radius:12px; color:black; border:${d.isPinned ? '2px solid purple' : '1px solid #eee'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);`;
    
    div.innerHTML = renderPostHTML(id, d, uid, isAdmin);

    if (position === "prepend") feed.prepend(div);
    else if (position === "top-append") {
        // အသစ်တက်လာတဲ့ Post ကို အပေါ်ဆုံးပို့ရန်
        const firstNonPinned = feed.querySelector('.post-card:not([style*="purple"])');
        if (firstNonPinned) feed.insertBefore(div, firstNonPinned);
        else feed.appendChild(div);
    }
    else feed.appendChild(div); // Pagination အတွက် အောက်ဆုံးမှာ ပေါင်းထည့်ခြင်း
}

// Modified ဖြစ်တဲ့အခါ UI ပြင်တဲ့ Logic
function updatePostUI(postEl, id, d, uid, isAdmin) {
    postEl.style.border = d.isPinned ? '2px solid purple' : '1px solid #eee';
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    
    const reactionArea = postEl.querySelector('.action-bar-content');
    if (reactionArea) {
        reactionArea.innerHTML = `
            <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:bold; color:${isLiked?'#007bff':'gray'}; font-size:14px;">👍 Like (${d.likes||0})</span>
            <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:bold; color:${isHahaed?'#ff9800':'gray'}; font-size:14px;">😆 Haha (${d.hahas||0})</span>
        `;
    }

    const statArea = postEl.querySelector('.stat-content');
    if (statArea) {
        statArea.innerHTML = `👁️ ${d.views||0} | <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold;">🚀 Share (${d.shares||0})</span>`;
    }

    const commArea = document.getElementById(`comms-${id}`);
    if (commArea && typeof renderComments === "function") {
        commArea.innerHTML = renderComments(id, d.comments, isAdmin, uid);
    }
}

function formatTime(timestamp) {
    if (!timestamp || !timestamp.seconds) return "ခုနကတင်"; // Pending ဖြစ်နေရင် ခုနကတင် လို့ပဲပြမယ်
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "ခုနကတင်";
    if (diff < 3600) return Math.floor(diff / 60) + " မိနစ်ခန့်က";
    if (diff < 86400) return Math.floor(diff / 3600) + " နာရီခန့်က";
    if (diff < 172800) return "မနေ့က";
    
    // မြန်မာနိုင်ငံသုံး ရက်စွဲပုံစံ (ဥပမာ - ၁၂ မေ ၂၀၂၄)
    return date.toLocaleDateString('my-MM', { day: 'numeric', month: 'short', year: 'numeric' });
}
function renderPostHTML(id, d, uid, isAdmin) {
    const isLiked = (d.likedBy || []).includes(uid);
    const isHahaed = (d.hahaedBy || []).includes(uid);
    const timeDisplay = formatTime(d.createdAt);

    // --- ၁။ Media Logic (Video & Horizontal Slider) ---
    let mediaContent = "";
    const images = d.mediaUrls || (d.mediaUrl ? [d.mediaUrl] : []);

    if (images.length > 0) {
        if (d.mediaType === 'video' || images[0].toLowerCase().includes('.mp4')) {
            let finalVideoUrl = images[0];
            if (finalVideoUrl.includes('b-cdn.net') && !finalVideoUrl.includes('/public-hospitals/')) {
                finalVideoUrl = finalVideoUrl.replace('b-cdn.net/', 'b-cdn.net/public-hospitals/');
            }
            mediaContent = `
                <div style="margin-top:10px; background:#000; border-radius:12px; overflow:hidden; aspect-ratio: 16/9; display: flex; align-items: center; border: 1px solid #eee;">
                    <video class="post-video" onplay="incrementView('${id}')" controls playsinline preload="metadata" style="width:100%; max-height:450px;">
                        <source src="${finalVideoUrl}" type="video/mp4">
                    </video>
                </div>`;
        } else {
            if (images.length === 1) {
                mediaContent = `
                    <div style="margin-top:10px; cursor:pointer;" onclick="incrementView('${id}'); viewFullImage('${images[0]}')">
                        <img src="${images[0]}" style="width:100%; border-radius:12px; display:block; object-fit:cover; border: 1px solid #f0f0f0;" onerror="this.src='https://placehold.co/400x300?text=Image+Error'">
                    </div>`;
            } else {
                mediaContent = `
                <div class="media-slider-container" style="position: relative; margin-top:10px; overflow: hidden;">
                    <div class="media-slider" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 8px; scrollbar-width: none; -ms-overflow-style: none;">
                        ${images.map((url, index) => `
                            <div style="flex: 0 0 85%; scroll-snap-align: center; position: relative; aspect-ratio: 4/3; cursor: pointer;" 
                                 onclick="incrementView('${id}'); viewFullImage('${url}')">
                                <img src="${url}" 
                                     style="width:100%; height:100%; object-fit:cover; border-radius:12px; border: 1px solid #f0f0f0;" 
                                     loading="lazy"
                                     onerror="this.src='https://placehold.co/400x300?text=Image+Error'">
                                <div style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:2px 8px; border-radius:10px; font-size:10px; font-family: sans-serif;">
                                    ${index + 1} / ${images.length}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        }
    }

    const safeText = (d.text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; flex-direction: column; min-width: 0;">
                <div style="font-weight: bold; color: #4b0082; font-size: 15px;">
                    ${getDisplayNameWithBadge(d)}
                </div>
                <div style="color: gray; font-size: 11px;">${timeDisplay}</div>
            </div>
            
            <div style="display: flex; gap: 15px;">
                ${isAdmin ? `<span onclick="togglePin('${id}', ${d.isPinned || false})" style="cursor:pointer; font-size:18px;">${d.isPinned ? '📌' : '📍'}</span>` : ''}
                ${isAdmin ? `<span onclick="deletePost('${id}')" style="cursor:pointer; font-size:18px;">🗑️</span>` : ''}
            </div>
        </div>

        <p style="margin: 8px 0; white-space: pre-wrap; font-size: 14.5px; line-height: 1.6; color: #1c1e21;">${safeText}</p>
        
        ${mediaContent}
        
        <div style="display: flex; justify-content: space-between; margin-top: 15px; border-top: 1px solid #f0f2f5; padding-top: 12px;">
            <div class="action-bar-content" style="display: flex; gap: 20px;">
                <span onclick="handleReact('${id}', 'likes')" style="cursor:pointer; font-weight:600; color:${isLiked?'#1877f2':'#65676b'}; font-size:13.5px; display:flex; align-items:center; gap:5px;">
                    👍 <span>${d.likes||0}</span>
                </span>
                <span onclick="handleReact('${id}', 'hahas')" style="cursor:pointer; font-weight:600; color:${isHahaed?'#f7b125':'#65676b'}; font-size:13.5px; display:flex; align-items:center; gap:5px;">
                    😆 <span>${d.hahas||0}</span>
                </span>
            </div>
            <div class="stat-content" style="font-size: 12px; color: #65676b; display: flex; align-items: center; gap: 8px;">
                <span>👁️ ${d.views||0}</span>
                <span style="color: #ddd;">|</span>
                <span onclick="handleShare('${id}')" style="cursor:pointer; color:purple; font-weight:bold; background: #f3e5f5; padding: 2px 8px; border-radius: 12px;">🚀 Share (${d.shares||0})</span>
            </div>
        </div>

        <div style="margin-top: 12px; background: #f0f2f5; border-radius: 12px; padding: 8px; border: 1px solid #e4e6eb;">
            <div id="comms-${id}" style="max-height: 250px; overflow-y: auto; scroll-behavior: smooth;">
                ${renderComments(id, d.comments, isAdmin, uid)}
            </div>
            
            <div style="display: flex; gap: 8px; padding: 8px 4px 4px 4px; border-top: 1px solid #e4e6eb; margin-top: 8px;">
                <input type="text" id="in-${id}" placeholder="မှတ်ချက်ပေးရန်..." 
                       onkeypress="if(event.key==='Enter') addComment('${id}')"
                       style="flex:1; border-radius: 20px; border: 1px solid #ddd; padding: 8px 15px; font-size: 13.5px; outline: none; background: white;">
                <button onclick="addComment('${id}')" style="color: white; border: none; background: purple; font-weight: bold; cursor: pointer; padding: 0 15px; border-radius: 18px; font-size: 13px;">ပို့မည်</button>
            </div>
        </div>`;
}


async function handleReact(id, type) {
    const user = auth.currentUser;
    if (!user) {
        if (typeof showPhoneLogin === "function") showPhoneLogin(); // Modal ပွင့်ခိုင်းလိုက်တာ ပိုကောင်းပါတယ်
        return;
    }

    const ref = db.collection("health_posts").doc(id);
    const uid = user.uid;
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    try {
        // Read အရင်လုပ်စရာမလိုဘဲ Update ကို တန်းပို့ကြည့်မယ် (Performance ပိုမြန်တယ်)
        const snap = await ref.get();
        const d = snap.data();
        
        if (d[field]?.includes(uid)) {
            await ref.update({
                [field]: firebase.firestore.FieldValue.arrayRemove(uid),
                [countField]: firebase.firestore.FieldValue.increment(-1)
            });
        } else {
            await ref.update({
                [field]: firebase.firestore.FieldValue.arrayUnion(uid),
                [countField]: firebase.firestore.FieldValue.increment(1)
            });
        }
    } catch (e) {
        console.error("React Error:", e);
    }
}
async function addComment(id) {
    const user = auth.currentUser;
    if (!user) return typeof showPhoneLogin === 'function' ? showPhoneLogin() : alert("Login အရင်ဝင်ပါ");
    
    const inputField = document.getElementById(`in-${id}`);
    const btn = event.target; // နှိပ်လိုက်တဲ့ Button ကို ယူခြင်း
    const val = inputField.value.trim();
    
    if (!val) return;

    try {
        // ၁။ Double Click ကာကွယ်ရန် Button ကို Disable လုပ်ခြင်း
        if (btn && btn.tagName === "BUTTON") btn.disabled = true;

        // ၂။ Badge status အတွက် User Data ကို အရင်ယူခြင်း
        const userDoc = await db.collection("users").doc(user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // ၃။ ပိုမိုပြည့်စုံသော Comment Object (Reaction fields ပါဝင်သည်)
        const newComment = {
            uid: user.uid,
            author: user.displayName || "User",
            isCrown: userData.isCrown || false,
            isGold: userData.isGold || false,
            text: val,
            // Senior ပေါင်းထားတဲ့ reactComment logic အတွက် မရှိမဖြစ်လိုအပ်တဲ့ Fields များ
            likes: 0, 
            likedBy: [], 
            hahas: 0, 
            hahaedBy: [], 
            // Unique ID အဖြစ် သုံးနိုင်ရန် Date.now() (Timestamp)
            createdAt: Date.now() 
        };

        // ၄။ Firestore Update
        await db.collection("health_posts").doc(id).update({
            comments: firebase.firestore.FieldValue.arrayUnion(newComment)
        });

        // ၅။ UI Reset
        inputField.value = "";
        console.log("✅ Comment added successfully!");

    } catch (e) {
        console.error("Comment Error:", e);
        alert("မှတ်ချက်ပေးလို့ မရပါဘူး Senior၊ ခဏနေမှ ပြန်ကြိုးစားကြည့်ပါ။");
    } finally {
        // ၆။ အောင်မြင်သည်ဖြစ်စေ၊ မအောင်မြင်သည်ဖြစ်စေ Button ကို ပြန်ဖွင့်ပေးခြင်း
        if (btn && btn.tagName === "BUTTON") btn.disabled = false;
    }
}

function renderComments(postId, comments, isAdmin, uid) {
    if (!comments || comments.length === 0) return "";

    // Original Index ကိုပါ သိမ်းပြီးမှ Sort လုပ်ပါမယ် (Reaction မှားမသွားအောင်)
    const sortedComments = comments.map((c, index) => ({...c, originalIndex: index}))
        .sort((a, b) => {
            const scoreA = (a.likes || 0) + (a.hahas || 0);
            const scoreB = (b.likes || 0) + (b.hahas || 0);
            return scoreB - scoreA;
        });

    const limit = 3; // Senior ၅ ခုဆိုတာ နည်းနည်းရှည်နိုင်လို့ ၃ ခုနဲ့ အရင်ပြတာ ပိုကျစ်လစ်ပါတယ်
    const hasMore = sortedComments.length > limit;
    
    // HTML ထုတ်ပေးမယ့် Helper Function
    const getCommentRow = (c, i, isHidden = false) => {
        const isTop = (i === 0 && ((c.likes||0) + (c.hahas||0) > 0));
        const safeText = c.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        return `
        <div style="background:#f0f2f5; margin-bottom:6px; padding:10px; border-radius:12px; font-size:12.5px; text-align:left; border-left:${isTop?'4px solid #ffd700':''}; transition: 0.3s;">
            ${isTop ? '<small style="color:#b8860b; font-weight:bold; font-size:10px;">🏆 TOP COMMENT</small><br>' : ''}
            <b style="color:#4b0082;">${getDisplayNameWithBadge(c)}</b> 
            <p style="margin:4px 0; color:#1c1e21; line-height:1.4;">${safeText}</p>
            <div style="margin-top:6px; display:flex; gap:15px; align-items:center;">
                <span onclick="reactComment('${postId}', ${c.originalIndex}, 'likes')" style="cursor:pointer; font-weight:bold; color:${(c.likedBy||[]).includes(uid)?'#1877f2':'#65676b'}">👍 ${c.likes||0}</span>
                <span onclick="reactComment('${postId}', ${c.originalIndex}, 'hahas')" style="cursor:pointer; font-weight:bold; color:${(c.hahaedBy||[]).includes(uid)?'#f7b125':'#65676b'}">😆 ${c.hahas||0}</span>
                ${isAdmin ? `<span onclick="deleteComment('${postId}', ${c.originalIndex})" style="color:#d93025; cursor:pointer; margin-left:auto; font-size:11px;">ဖျက်ရန်</span>` : ''}
            </div>
        </div>`;
    };

    let html = sortedComments.slice(0, limit).map((c, i) => getCommentRow(c, i)).join('');

    if (hasMore) {
        html += `
        <div id="more-btn-${postId}" onclick="document.getElementById('extra-comms-${postId}').style.display='block'; this.style.display='none'" 
             style="color:purple; font-size:12px; cursor:pointer; font-weight:bold; margin:8px 0; padding:5px; text-align:center;">
            💬 နောက်ထပ်မှတ်ချက် ${sortedComments.length - limit} ခုကို ဖတ်ရန်...
        </div>
        <div id="extra-comms-${postId}" style="display:none;">
            ${sortedComments.slice(limit).map((c, i) => getCommentRow(c, i + limit)).join('')}
        </div>`;
    }
    
    return html;
}
async function reactComment(postId, commentCreatedAt, type) {
    const user = auth.currentUser;
    if (!user) return alert("Login အရင်ဝင်ပါ Senior");

    const uid = user.uid;
    const ref = db.collection("health_posts").doc(postId);
    const field = type === 'likes' ? 'likedBy' : 'hahaedBy';
    const countField = type === 'likes' ? 'likes' : 'hahas';

    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(ref);
            if (!postDoc.exists) throw new Error("Post does not exist!");

            const postData = postDoc.data();
            let comments = postData.comments ? [...postData.comments] : [];

            // ၁။ Logic ပေါင်းစပ်မှု - CreatedAt (Unique Time) ကို သုံးပြီး မှန်ကန်တဲ့ Comment ကို ရှာပါမယ်
            // ၎င်းသည် Sorting ကြောင့် Index ပြောင်းသွားလည်း အမှားမရှိ ရှာနိုင်စေပါတယ်
            const cIndex = comments.findIndex(c => c.createdAt === commentCreatedAt);

            if (cIndex === -1) {
                console.error("Comment not found for timestamp:", commentCreatedAt);
                return;
            }

            let c = comments[cIndex];
            
            // ၂။ Reaction Logic (Like/Haha)
            if (!c[field]) c[field] = [];
            let isAddingReaction = false;

            if (c[field].includes(uid)) {
                // Reaction ပြန်ဖြုတ်ခြင်း (Unlike/Un-haha)
                c[field] = c[field].filter(x => x !== uid);
                c[countField] = Math.max(0, (c[countField] || 0) - 1);
            } else {
                // Reaction အသစ်ပေးခြင်း
                c[field].push(uid);
                c[countField] = (c[countField] || 0) + 1;
                isAddingReaction = true;
            }

            // ၃။ Firestore ထဲသို့ တစ်ခုလုံးကို Update ပြန်လုပ်ခြင်း
            transaction.update(ref, { comments: comments });

            // ၄။ Notification Logic (Transaction အောင်မြင်မှ ပို့ရန် - Async)
            // ကိုယ်ပေးတဲ့ Reaction က ကိုယ့် Comment မဟုတ်မှသာ Notification ပို့ပါမယ်
            if (isAddingReaction && c.uid !== uid) {
                sendCommentNotification(c.uid, type);
            }
        });

        console.log(`✅ Reaction ${type} updated successfully via Transaction.`);
    } catch (e) {
        console.error("❌ React Transaction Error:", e);
    }
}

// Notification အတွက် Helper Function ခွဲထုတ်လိုက်တာ ပိုကျစ်လစ်ပါတယ်
async function sendCommentNotification(receiverId, type) {
    const reactionName = type === 'likes' ? "Like ❤️" : "Haha 😂";
    await db.collection("notifications").add({
        receiverId: receiverId,
        senderId: auth.currentUser.uid,
        title: "Reaction အသစ်ရှိပါသည်",
        body: `${auth.currentUser.displayName || "User"} က သင်၏ Comment ကို ${reactionName} ပေးလိုက်ပါတယ်`,
        status: "unread",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function deleteComment(postId, index) {
    if(!confirm("ဤမှတ်ချက်ကို ဖျက်မလား Senior?")) return;
    
    const ref = db.collection("health_posts").doc(postId);
    
    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(ref);
            let comments = [...postDoc.data().comments];
            comments.splice(index, 1);
            transaction.update(ref, { comments });
        });
        console.log("Comment Deleted Successfully");
    } catch (e) {
        console.error("Delete Error:", e);
    }
}
async function togglePin(id, current) { await db.collection("health_posts").doc(id).update({ isPinned: !current }); }
async function deletePost(id) { if(confirm("ဖျက်မှာလား Senior?")) await db.collection("health_posts").doc(id).delete(); }
async function incrementView(id) { db.collection("health_posts").doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }); }
async function handleShare(id) {
    if (!auth.currentUser) return alert("Login အရင်ဝင်ပါ Senior");
    
    try {
        const ref = db.collection("health_posts").doc(id);
        const snap = await ref.get();
        if (!snap.exists) return alert("မူရင်း Post မရှိတော့ပါ");
        
        const d = snap.data();

        // ၁။ မူရင်း Post ရဲ့ Share Count ကို +1 တိုးမယ်
        await ref.update({ shares: firebase.firestore.FieldValue.increment(1) });

        // ၂။ Share တဲ့ Post အသစ်ကို သိမ်းမယ်
        // ဒါပေမဲ့ ပုံတွေ၊ စာတွေကို Copy မကူးတော့ဘဲ originalId ကိုပဲ သိမ်းမယ်
        await db.collection("health_posts").add({
            sharedBy: auth.currentUser.displayName,
            sharedByUid: auth.currentUser.uid,
            isShared: true, // Share ထားတဲ့ Post ဖြစ်ကြောင်း အမှတ်အသား
            originalPostId: id, // မူရင်း Post ID
            text: d.text, // Preview ပြဖို့ စာသားလေးပဲ ယူမယ်
            mediaUrl: d.mediaUrl || "", 
            mediaType: d.mediaType || "image",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Badge logic အတွက် share တဲ့လူရဲ့ status ပါ ထည့်ထားသင့်တယ်
            isCrown: d.isCrown || false, 
            isGold: d.isGold || false
        });

        alert("News Feed သို့ Share ပြီးပါပြီ Senior!");
    } catch (e) {
        console.error(e);
        alert("Share Error: " + e.message);
    }
}

// Increment View ကို User တစ်ယောက် တစ်ကြိမ်ပဲ တိုးအောင် စစ်ချင်ရင် (Optional)
async function incrementView(id) {
    const viewKey = `viewed_${id}`;
    if (localStorage.getItem(viewKey)) return; // ကြည့်ပြီးသားဆိုရင် မတိုးတော့ဘူး

    try {
        await db.collection("health_posts").doc(id).update({ 
            views: firebase.firestore.FieldValue.increment(1) 
        });
        localStorage.setItem(viewKey, "true");
    } catch(e) { console.log("View update failed"); }
}
// --- Global Variable for Memory Management ---
let currentPreviewUrl = null;

/**
 * ၁။ Media Preview Function
 * Memory Leak မဖြစ်အောင် အရင် URL ကို Revoke လုပ်ပြီးမှ အသစ်ပြသည်
 */
function previewMedia(input) {
    const box = document.getElementById('mediaPreviewBox');
    const file = input.files[0];
    
    if (file) {
        // အရင်ရှိနေတဲ့ Preview URL ကို Memory ထဲက ဖယ်ထုတ်သည်
        if (currentPreviewUrl) {
            URL.revokeObjectURL(currentPreviewUrl);
        }

        box.style.display = 'block';
        currentPreviewUrl = URL.createObjectURL(file);
        
        if (file.type.startsWith('video/')) {
            box.innerHTML = `
                <div style="position:relative;">
                    <video src="${currentPreviewUrl}" style="width:100%; border-radius:8px;" muted autoplay loop></video>
                    <small style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:white; padding:2px 5px; border-radius:4px;">Video Preview</small>
                </div>`;
        } else {
            box.innerHTML = `<img src="${currentPreviewUrl}" style="width:100%; border-radius:8px; display:block;">`;
        }
    }
}

function isSafeName(name) {
    if (!name) return false;
    const safePattern = /^[a-zA-Z0-9\u1000-\u109F\s\u200C\u200D]+$/;
    return safePattern.test(name);
}

/**
 * ၃။ နာမည်သိမ်းသည့် Function
 * Auth နှင့် Firestore ကို Sync လုပ်ပြီး Loading UI ပါဝင်သည်
 */
async function saveInitialName() {
    const nameInput = document.getElementById('setupUserName');
    const modal = document.getElementById('nameSetupModal');
    
    // ခေါ်လိုက်တဲ့ Button ကို ရှာပြီး Disable လုပ်ရန် (Double Click ကာကွယ်ရန်)
    const btn = document.querySelector('#nameSetupModal button');

    if(!nameInput) return;
    const inputName = nameInput.value.trim();

    // Layer 1: Length Validation
    if(inputName.length < 2) {
        return alert("အမည်အမှန်ရိုက်ပါ (အနည်းဆုံး ၂ လုံး)");
    }

    // Layer 2: Character Validation
    if (!isSafeName(inputName)) {
        return alert("Senior ရေ... နာမည်မှာ Emoji နဲ့ Special Character တွေ မသုံးပါနဲ့ဗျာ။ စာသားနဲ့ ဂဏန်းပဲ သုံးပေးပါ။");
    }

    try {
        // UI Feedback: Loading State
        if (btn) {
            btn.disabled = true;
            btn.innerText = "သိမ်းဆည်းနေပါသည်...";
        }

        const user = auth.currentUser;
        if (!user) throw new Error("User not logged in");

        // Firebase Auth Profile Update
        await user.updateProfile({ 
            displayName: inputName 
        });

        // Firestore Database Sync
        await db.collection("users").doc(user.uid).set({
            displayName: inputName,
            isProfileSetup: true,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log("Success: Name updated to " + inputName);
        
        // UI Update: Reload မလုပ်ဘဲ Modal ပိတ်ပြီး အမည်ကို တန်းပြောင်းမည်
        if (modal) modal.style.display = 'none';
        const nameDisplay = document.getElementById('userNameDisplay');
        if (nameDisplay) nameDisplay.innerText = inputName;

        alert("အမည်အတည်ပြုပြီးပါပြီ Senior!");

    } catch (error) {
        console.error("Error saving name: ", error);
        alert("သိမ်းလို့မရဖြစ်နေပါတယ် Senior: " + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "အတည်ပြုမည်";
        }
    }
}

/**
 * ၄။ Hidden Comments များကို ပြသသည့် Function
 */
function showAllComments(postId) {
    const extra = document.getElementById(`extra-comms-${postId}`);
    const btn = document.getElementById(`more-btn-${postId}`);
    
    if (extra && btn) {
        // ချောမွေ့စွာ ပေါ်လာစေရန် (Simple Animation transition ထည့်လိုပါက CSS တွင် ထည့်နိုင်သည်)
        extra.style.display = 'block';
        btn.style.display = 'none';
    }
}
async function startLiveNotifications() {
    const user = auth.currentUser;
    if (!user) return;

    // Browser Notification Permission တောင်းခြင်း
    if (Notification.permission === "default") {
        await Notification.requestPermission();
    }

    db.collection("notifications")
      .where("receiverId", "==", user.uid)
      .where("status", "==", "unread")
      .onSnapshot(snap => {
          snap.docChanges().forEach(async (change) => {
              if (change.type === "added") {
                  const d = change.doc.data();
                  const docId = change.doc.id;

                  if (Notification.permission === "granted") {
                      // --- Senior ရဲ့ Logo ကို Notification Icon အဖြစ် ထည့်သွင်းခြင်း ---
                      new Notification(d.title, { 
                          body: d.body,
                          icon: 'https://i.ibb.co/RkJCm6CV/Gallery-1772168024425.jpg' // <--- ဒီမှာ ထည့်လိုက်ပါပြီ Senior
                      });
                  }

                  try {
                      await db.collection("notifications").doc(docId).update({ status: "read" });
                  } catch (e) {
                      console.error("Notify Read Error:", e);
                  }
              }
          });
      });
}

async function startAutoFriendSystem(myUid) {
    try {
        const myRef = db.collection("users").doc(myUid);
        const myDoc = await myRef.get();
        if (!myDoc.exists) return;
        
        const myData = myDoc.data();

        if (myData.isAutoFriendAdded === true) return;

        // Firestore Batch limit က ၅၀၀ ဖြစ်လို့ ၂၀-၅၀ ဝန်းကျင်က အန္တရာယ်ကင်းပါတယ်
        const limit = 20; 
        const usersSnap = await db.collection("users")
            .where("uid", "!=", myUid)
            .limit(limit) 
            .get();

        if (usersSnap.empty) {
            await myRef.update({ isAutoFriendAdded: true });
            return;
        }

        const batch = db.batch();
        let currentCount = 0;

        usersSnap.forEach(doc => {
            const otherUser = doc.data();
            const otherUid = doc.id;

            // ၁။ ကိုယ့် Friend List ထဲ ထည့်မယ်
            const myFriendRef = myRef.collection("friends").doc(otherUid);
            batch.set(myFriendRef, {
                uid: otherUid,
                displayName: otherUser.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // ၂။ သူ့ Friend List ထဲ ကိုယ့်ကို ပြန်ထည့်မယ်
            const otherFriendRef = db.collection("users").doc(otherUid).collection("friends").doc(myUid);
            batch.set(otherFriendRef, {
                uid: myUid,
                displayName: myData.displayName || "User",
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            currentCount++;
        });

        // ၃။ Flag Update လုပ်မယ်
        batch.update(myRef, { 
            isAutoFriendAdded: true,
            friendCount: firebase.firestore.FieldValue.increment(currentCount),
            lastFriendSync: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`✅ Success: Added ${currentCount} friends automatically.`);

    } catch (e) {
        console.error("❌ AutoFriend Error:", e);
    }
}
/**
 * ၁။ Ban Status စစ်ဆေးသည့် Function
 * Device ID ရော UID ကိုပါ Double Check လုပ်သည်
 */
async function checkBanStatus(userId, deviceId) {
    try {
        // တစ်ပြိုင်တည်း စစ်ဆေးခြင်း (Performance မြန်စေရန်)
        const [deviceSnap, userDoc] = await Promise.all([
            db.collection("banned_devices").doc(deviceId).get(),
            db.collection("users").doc(userId).get()
        ]);

        const userData = userDoc.exists ? userDoc.data() : null;

        if (deviceSnap.exists || (userData && userData.isBanned === true)) {
            // အရင်ဆုံး Sign Out လုပ်ပြီး Access ပိတ်မည်
            await auth.signOut();
            
            // LocalStorage ထဲမှာလည်း Ban ထားကြောင်း မှတ်ထားနိုင်သည် (Optional)
            localStorage.setItem("is_banned_permanently", "true");

            alert("Security Alert: သင့် Device သို့မဟုတ် အကောင့်သည် စည်းကမ်းဖောက်ဖျက်မှုကြောင့် အပြီးတိုင် ပိတ်ပင် (Ban) ခံထားရပါသည်။");
            
            // Ban Page သို့ ပို့မည်
            window.location.href = "banned_info.html";
            return true; // Banned ဖြစ်နေကြောင်း သိစေရန်
        }
        return false;
    } catch (e) {
        console.error("Ban Check Error:", e);
        return false;
    }
}
async function submitFeedback() {
    const feedbackArea = document.getElementById('feedbackMsg');
    const msg = feedbackArea.value.trim();
    if (!msg) return alert("စာသားလေး တစ်ခုခု ရေးပေးပါဦး Senior");

    try {
        const user = auth.currentUser;
        const currentDevId = await getMyDeviceId(); // Senior ရဲ့ Fingerprint ID ယူခြင်း

        // UI Feedback: ပို့နေတုန်း Button ခဏပိတ်ထားမယ်
        const sendBtn = event.target;
        if(sendBtn && sendBtn.tagName === "BUTTON") sendBtn.disabled = true;

        await db.collection("feedbacks").add({
            uid: user.uid,
            userName: user.displayName || "အမည်မသိ",
            feedbackMsg: msg,
            deviceId: currentDevId, // Admin က Ban ချင်ရင် ဒီ ID နဲ့ ချလို့ရအောင်
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            version: "1.0.0",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ကျေးဇူးတင်ပါတယ် Senior! သင့်ရဲ့ အကြံပြုချက်ကို Admin ဆီ တင်ပြပေးလိုက်ပါပြီ။");
        feedbackArea.value = ""; 
        
        if(sendBtn && sendBtn.tagName === "BUTTON") sendBtn.disabled = false;
        
    } catch (e) {
        alert("Error: " + e.message);
    }
}
  window.addComment = addComment;
    window.reactComment = reactComment;
    window.handleReact = handleReact;
    window.handleShare = handleShare;
    window.deletePost = deletePost;
    window.togglePin = togglePin;
    window.previewMedia = previewMedia;
window.viewFullImage = viewFullImage; 
window.incrementView = incrementView;

window.submitFeedback = submitFeedback;
    window.ADMIN_EMAIL = ADMIN_EMAIL;
})();

