document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    // 1. 각 페이지별 SEO 및 URL 데이터 (ID를 molarity-calc로 변경)
    const seoData = {
        'molarity-calc': {
            title: "Molarity Calculator | Scientist's Toolkit",
            desc: "Calculate Mass, Concentration, Volume, and MW easily for your lab experiments.",
            url: "https://scientisttoolkit.xyz/molarity-calc"
        },
        'outlier-checker': {
            title: "Outlier Checker | Scientist's Toolkit",
            desc: "Identify data outliers using the IQR method and check normality.",
            url: "https://scientisttoolkit.xyz/outlier-checker"
        },
        'hed-calculator': {
            title: "HED Calculator | Scientist's Toolkit",
            desc: "Convert animal doses to Human Equivalent Dose (HED) based on FDA guidelines.",
            url: "https://scientisttoolkit.xyz/hed-calculator"
        },
        'help-section': {
            title: "Help & Info | Scientist's Toolkit",
            desc: "User guide and official FDA references for the toolkit.",
            url: "https://scientisttoolkit.xyz/help-section"
        },
        'comments-section': {
            title: "Comments | Scientist's Toolkit",
            desc: "Leave your feedback and questions for the developer.",
            url: "https://scientisttoolkit.xyz/comments-section"
        }
    };

    // 2. 섹션 전환 및 주소창 변경 함수
    function showSection(targetId, updateHistory = true) {
        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        const targetSection = document.getElementById(targetId);
        const targetBtn = document.querySelector(`[data-target="${targetId}"]`);

        if (targetSection && targetBtn) {
            targetSection.classList.add('active');
            targetBtn.classList.add('active');

            const data = seoData[targetId];
            if (data) {
                document.title = data.title;
                const meta = document.getElementById('meta-desc');
                if(meta) meta.setAttribute('content', data.desc);
            }

            // [수정됨] 모든 탭에 대해 고유한 경로를 부여합니다.
            if (updateHistory) {
                window.history.pushState({ targetId: targetId }, '', '/' + targetId);
            }
        }
    }

    // 3. 버튼 클릭 이벤트
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            showSection(targetId);
        });
    });

    // 4. 뒤로가기 대응
    window.addEventListener('popstate', (e) => {
        const id = (e.state && e.state.targetId) ? e.state.targetId : 'molarity-calc';
        showSection(id, false);
    });

    // 5. 초기 접속 처리 (루트 접속 시 molarity-calc로 연결)
    const urlPath = window.location.pathname.replace('/', '');
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('p') ? urlParams.get('p').replace('/', '') : urlPath;

    // 경로가 없거나 잘못된 경우 기본값 'molarity-calc' 사용
    const finalPath = (redirectPath && document.getElementById(redirectPath)) ? redirectPath : 'molarity-calc';
    showSection(finalPath, false);

    // --- 이하 계산기 로직 (생략, 기존 코드 그대로 사용하세요) ---
    // [이곳에 기존 Molarity, Outlier, HED 계산 로직을 붙여넣으세요]
});