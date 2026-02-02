// =========================================================
// 1. Firebase 설정 (사용자님의 API Key 적용됨)
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyB4LNbqa_msSQqHigfnlJ5RaxfLNJvg_Jg",
    authDomain: "scientisttoolkit.firebaseapp.com",
    projectId: "scientisttoolkit",
    storageBucket: "scientisttoolkit.firebasestorage.app",
    messagingSenderId: "611412737478",
    appId: "1:611412737478:web:e7389b1b03c002f56546c7",
    measurementId: "G-5K0XVX0TFM"
};

// =========================================================
// 2. Firebase 초기화
// =========================================================
// 이미 초기화되었는지 확인 후 초기화 (중복 방지)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
// 서비스 연결
const db = firebase.firestore();
const analytics = firebase.analytics(); // 애널리틱스도 연결됨

// =========================================================
// 3. 게시판 기능 로직
// =========================================================

// XSS 방지 함수 (보안용)
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 글 목록 불러오기 함수
function loadPosts() {
    const listArea = document.getElementById('post-list');
    
    // DB에서 'posts' 컬렉션을 날짜 내림차순으로 가져옴
    db.collection("posts").orderBy("date", "desc").limit(30).get()
    .then((querySnapshot) => {
        let html = "";
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dateObj = data.date ? data.date.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

            html += `
                <div class="post-card">
                    <div class="post-header">
                        <span class="post-title">${escapeHtml(data.title)}</span>
                        <span class="post-info">by <strong>${escapeHtml(data.name)}</strong> | ${dateStr}</span>
                    </div>
                    <div class="post-body">${escapeHtml(data.content)}</div>
                </div>
            `;
        });

        if (html === "") {
            listArea.innerHTML = '<div class="loading-msg">No posts yet. Be the first to write!</div>';
        } else {
            listArea.innerHTML = html;
        }
    })
    .catch((error) => {
        console.error("Error loading posts:", error);
        if (error.code === 'permission-denied') {
            listArea.innerHTML = '<div class="loading-msg" style="color:red;">Error: Permission Denied. <br>Please check Firestore Rules to "Test Mode".</div>';
        } else {
            listArea.innerHTML = '<div class="loading-msg" style="color:red;">Error loading posts. Please try again later.</div>';
        }
    });
}

// 글 저장 버튼 이벤트
const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('writer-name');
        const titleInput = document.getElementById('post-title');
        const contentInput = document.getElementById('post-content');

        const name = nameInput.value.trim();
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!name || !title || !content) {
            alert("Please fill in all fields.");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        // DB에 저장
        db.collection("posts").add({
            name: name,
            title: title,
            content: content,
            date: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            alert("Post uploaded successfully!");
            nameInput.value = "";
            titleInput.value = "";
            contentInput.value = "";
            loadPosts();
        })
        .catch((error) => {
            console.error("Error writing post: ", error);
            alert("Failed to upload post: " + error.message);
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = "Post";
        });
    });
}

// 페이지 로드 시 목록 불러오기
document.addEventListener('DOMContentLoaded', loadPosts);