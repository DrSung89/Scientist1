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
// 3. 방문자 수 카운터 (게시판 전용)
// =========================================================
function updateVisitorCount() {
    const countSpan = document.getElementById('visitor-count');
    
    // 오늘 날짜 생성 (한국 시간 기준)
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const dateStr = (new Date(today - offset)).toISOString().split('T')[0];

    const docRef = db.collection('visitors').doc(dateStr);
    const hasVisited = sessionStorage.getItem(`visited_${dateStr}`);

    // 1. 방문 기록 없으면 카운트 증가
    if (!hasVisited) {
        docRef.set({
            count: firebase.firestore.FieldValue.increment(1)
        }, { merge: true })
        .then(() => {
            sessionStorage.setItem(`visited_${dateStr}`, 'true');
        })
        .catch(err => console.error("Error updating count:", err));
    }

    // 2. 실시간 숫자 표시
    docRef.onSnapshot((doc) => {
        if (doc.exists) {
            const count = doc.data().count;
            if(countSpan) countSpan.innerHTML = `Today's Visitors: <strong>${count.toLocaleString()}</strong>`;
        } else {
            if(countSpan) countSpan.innerHTML = `Today's Visitors: <strong>1</strong>`;
        }
    });
}
// 페이지 로드 시 카운터 실행
updateVisitorCount();


// =========================================================
// 4. 게시판 기능 로직 (페이지네이션 & 3개월 필터 적용)
// =========================================================

// 전역 변수 (페이지 관리용)
let postsPerPage = 10;        // 한 페이지당 글 개수
let currentPage = 1;          // 현재 페이지 번호
let lastVisibleDocs = [];     // 각 페이지의 마지막 글 저장 (다음 페이지 이동용)

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
// Self-service deletion is disabled until server-side authentication is implemented.

// [핵심] 글 목록 불러오기 (클릭형 아코디언 방식 적용)
function loadPosts(direction = 'init') {
    const listArea = document.getElementById('post-list');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageNum = document.getElementById('page-num');

    // 로딩 표시
    listArea.innerHTML = '<div class="loading-msg">Loading protocols...</div>';

    // 1. 3개월 전 날짜 계산
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 2. 쿼리 설정
    let query = db.collection("posts")
        .where("date", ">=", threeMonthsAgo)
        .orderBy("date", "desc")
        .limit(postsPerPage);

    // 3. 페이지 방향 설정
    if (direction === 'next') {
        const lastDoc = lastVisibleDocs[currentPage - 1];
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
    } else if (direction === 'prev') {
        if (currentPage > 2) {
            const prevLastDoc = lastVisibleDocs[currentPage - 3];
            query = query.startAfter(prevLastDoc);
        }
    }

    // 4. 데이터 가져오기
    query.get().then((querySnapshot) => {
        const docs = querySnapshot.docs;
        
        if (direction === 'init') {
            currentPage = 1;
            lastVisibleDocs = [];
        } else if (direction === 'next') {
            currentPage++;
        } else if (direction === 'prev') {
            currentPage--;
            lastVisibleDocs = lastVisibleDocs.slice(0, currentPage); 
        }

        if (docs.length > 0) {
            lastVisibleDocs[currentPage - 1] = docs[docs.length - 1];
        }

        // ★ HTML 그리기 (여기가 변경됨) ★
        listArea.innerHTML = ""; // 기존 내용 비우기

        if (docs.length === 0) {
            listArea.innerHTML = '<div class="loading-msg">No protocols shared yet. Be the first!</div>';
        } else {
            docs.forEach((doc) => {
                const data = doc.data();
                const dateObj = data.date ? data.date.toDate() : new Date();
                const dateStr = dateObj.toLocaleDateString(); // 날짜만 간단히 표시

                // 1. 게시물 컨테이너 생성
                const postItem = document.createElement("div");
                postItem.className = "post-item";

                // 2. 헤더 생성 (클릭할 부분)
                const header = document.createElement("div");
                header.className = "post-header";
                header.innerHTML = `
                    <span class="post-title">🧪 ${escapeHtml(data.title)}</span>
                    <span class="post-meta">${escapeHtml(data.name)} | ${dateStr}</span>
                `;

                // 3. 본문 생성 (숨겨진 부분)
               const contentDiv = document.createElement("div");
               contentDiv.className = "post-content";
               contentDiv.innerHTML = `
                <div style="margin-top: 10px; margin-bottom: 5px;">${escapeHtml(data.content)}</div>

                `;

                // 4. 클릭 이벤트 (열고 닫기)
                header.addEventListener("click", () => {
                    // 다른 열린 게시물이 있으면 닫기 (선택사항 - 원하면 주석 해제)
                    // document.querySelectorAll('.post-content').forEach(el => el.classList.remove('show'));
                    
                    contentDiv.classList.toggle("show");
                });

                // 5. 조립
                postItem.appendChild(header);
                postItem.appendChild(contentDiv);
                listArea.appendChild(postItem);
            });
        }

        // 5. 버튼 상태 업데이트
        pageNum.innerText = `Page ${currentPage}`;
        prevBtn.style.display = currentPage > 1 ? "inline-block" : "none";
        
        if (docs.length < postsPerPage) {
            nextBtn.style.display = "none";
        } else {
            nextBtn.style.display = "inline-block";
        }

    }).catch((error) => {
        console.error("Error loading posts:", error);
        if (error.message.includes("index")) {
            listArea.innerHTML = '<div class="loading-msg" style="color:red;">⚠️ Index Required. Check console.</div>';
        } else {
            listArea.innerHTML = '<div class="loading-msg" style="color:red;">Error loading posts.</div>';
        }
    });
}

// 버튼 이벤트 리스너
const prevBtnEl = document.getElementById('prev-btn');
const nextBtnEl = document.getElementById('next-btn');

if(prevBtnEl) prevBtnEl.addEventListener('click', () => loadPosts('prev'));
if(nextBtnEl) nextBtnEl.addEventListener('click', () => loadPosts('next'));

// 글 저장 버튼 이벤트
const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const name = document.getElementById('writer-name').value.trim();
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();

        if (!name || !title || !content) {
            alert("Please fill in your nickname, title, and post content.");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerText = "Sharing...";

        db.collection("posts").add({
            name: name,
            title: title,
            content: content,
            date: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            alert("Post Uploaded!");
            // 입력창 초기화
            document.getElementById('writer-name').value = "";
            document.getElementById('post-title').value = "";
            document.getElementById('post-content').value = "";
            
            loadPosts('init'); // 목록 새로고침
        })
        .catch((error) => {
            alert("Error: " + error.message);
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = "Share Method";
        });
    });
}

// 초기 실행
document.addEventListener('DOMContentLoaded', () => loadPosts('init'));