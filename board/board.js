// =========================================================
// 1. Firebase 설정 (API Key 유지)
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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// =========================================================
// 3. 게시판 기능 로직 (페이지네이션 & 3개월 필터 적용)
// =========================================================

// 전역 변수 (페이지 관리용)
let postsPerPage = 10;        // 한 페이지당 글 개수 (여기서 수정 가능)
let currentPage = 1;          // 현재 페이지 번호
let lastVisibleDocs = [];     // 각 페이지의 마지막 글 저장 (다음 페이지 이동용)
let isLastPage = false;       // 마지막 페이지인지 여부

// XSS 방지 함수
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 삭제 함수 (관리자/비밀번호)
window.deletePost = function(docId) {
    const inputPw = prompt("Enter password to delete:");
    if (inputPw === null) return;

    const ADMIN_KEY = "admin1234"; // 관리자 키

    db.collection("posts").doc(docId).get().then((doc) => {
        if (doc.exists) {
            const realPw = doc.data().password;
            if (inputPw === ADMIN_KEY || inputPw === realPw) {
                db.collection("posts").doc(docId).delete().then(() => {
                    alert("Deleted successfully.");
                    // 삭제 후 현재 페이지 새로고침 (페이지 로직 초기화)
                    currentPage = 1;
                    lastVisibleDocs = [];
                    loadPosts(); 
                }).catch((error) => {
                    alert("Error deleting: " + error.message);
                });
            } else {
                alert("Incorrect password!");
            }
        } else {
            alert("Post no longer exists.");
        }
    }).catch((error) => {
        console.error("Error checking password:", error);
    });
};

// [핵심] 글 목록 불러오기 (페이지네이션 + 3개월 필터)
function loadPosts(direction = 'init') {
    const listArea = document.getElementById('post-list');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageNum = document.getElementById('page-num');

    // 로딩 표시
    listArea.innerHTML = '<div class="loading-msg">Loading...</div>';

    // 1. 3개월 전 날짜 계산 (Date 객체)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 2. 쿼리 기본 설정 (3개월 이내 글만, 최신순)
    let query = db.collection("posts")
        .where("date", ">=", threeMonthsAgo) // ★ 3개월 필터
        .orderBy("date", "desc")
        .limit(postsPerPage);

    // 3. 페이지 방향에 따른 커서 설정
    if (direction === 'next') {
        const lastDoc = lastVisibleDocs[currentPage - 1]; // 현재 페이지의 마지막 글
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
    } else if (direction === 'prev') {
        // 이전 페이지로 갈 때는, '전전 페이지'의 마지막 글 뒤부터 시작
        if (currentPage > 2) {
            const prevLastDoc = lastVisibleDocs[currentPage - 3];
            query = query.startAfter(prevLastDoc);
        }
        // currentPage가 2일 때는 처음(null)부터 시작하므로 설정 불필요
    }

    // 4. 데이터 가져오기
    query.get().then((querySnapshot) => {
        // 페이지 데이터 저장 (다음 페이지를 위해 마지막 글 기록)
        const docs = querySnapshot.docs;
        
        if (direction === 'init') {
            currentPage = 1;
            lastVisibleDocs = [];
        } else if (direction === 'next') {
            currentPage++;
        } else if (direction === 'prev') {
            currentPage--;
            // 뒤로 갔으니 뒷부분 기록은 날림
            lastVisibleDocs = lastVisibleDocs.slice(0, currentPage); 
        }

        // 현재 페이지의 마지막 글을 배열에 저장 (중복 방지)
        if (docs.length > 0) {
            lastVisibleDocs[currentPage - 1] = docs[docs.length - 1];
        }

        // HTML 그리기
        let html = "";
        docs.forEach((doc) => {
            const data = doc.data();
            const dateObj = data.date ? data.date.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            html += `
                <div class="post-card">
                    <div class="post-header">
                        <span class="post-title">${escapeHtml(data.title)}</span>
                        <div style="font-size: 0.8rem;">
                            <span class="post-info">by <strong>${escapeHtml(data.name)}</strong> | ${dateStr}</span>
                            <button onclick="deletePost('${doc.id}')" style="margin-left:10px; color:red; border:1px solid red; background:white; cursor:pointer; border-radius:4px; padding:2px 6px; font-size:0.7rem;">Delete</button>
                        </div>
                    </div>
                    <div class="post-body">${escapeHtml(data.content)}</div>
                </div>
            `;
        });

        // 5. 버튼 상태 업데이트
        pageNum.innerText = `Page ${currentPage}`;
        prevBtn.style.display = currentPage > 1 ? "inline-block" : "none";
        
        // 다음 페이지가 있는지 확인 (가져온 개수가 요청 개수보다 적으면 끝)
        if (docs.length < postsPerPage) {
            nextBtn.style.display = "none";
        } else {
            nextBtn.style.display = "inline-block";
        }

        if (html === "") {
            listArea.innerHTML = '<div class="loading-msg">No posts found.</div>';
        } else {
            listArea.innerHTML = html;
        }

    }).catch((error) => {
        console.error("Error loading posts:", error);
        
        // ★ 중요: 인덱스 에러 처리 안내
        if (error.message.includes("index")) {
            listArea.innerHTML = '<div class="loading-msg" style="color:red;">⚠️ Index Required.<br>Open console (F12) and click the link from Firebase to create an index for "date".</div>';
        } else {
            listArea.innerHTML = '<div class="loading-msg" style="color:red;">Error loading posts.</div>';
        }
    });
}

// 버튼 이벤트 리스너
document.getElementById('prev-btn').addEventListener('click', () => loadPosts('prev'));
document.getElementById('next-btn').addEventListener('click', () => loadPosts('next'));

// 글 저장 버튼 이벤트
const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const name = document.getElementById('writer-name').value.trim();
        const title = document.getElementById('post-title').value.trim();
        const password = document.getElementById('post-password').value.trim();
        const content = document.getElementById('post-content').value.trim();

        if (!name || !title || !content || !password) {
            alert("Please fill in all fields (including Password).");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        db.collection("posts").add({
            name: name,
            title: title,
            password: password,
            content: content,
            date: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            alert("Post uploaded!");
            document.getElementById('writer-name').value = "";
            document.getElementById('post-title').value = "";
            document.getElementById('post-password').value = "";
            document.getElementById('post-content').value = "";
            loadPosts('init'); // 첫 페이지로 초기화
        })
        .catch((error) => {
            alert("Error: " + error.message);
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = "Post";
        });
    });
}

// 초기 실행
document.addEventListener('DOMContentLoaded', () => loadPosts('init'));