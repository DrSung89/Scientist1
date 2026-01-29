document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    // 1. 각 페이지별 SEO 데이터
    const seoData = {
        'molarity-calc': {
            title: "Molarity Calculator | Scientist's Toolkit",
            desc: "Calculate Mass, Concentration, Volume, and MW easily.",
            url: "https://scientisttoolkit.xyz/molarity-calc"
        },
        'outlier-checker': {
            title: "Outlier Checker | Scientist's Toolkit",
            desc: "Identify data outliers using the IQR method.",
            url: "https://scientisttoolkit.xyz/outlier-checker"
        },
        'hed-calculator': {
            title: "HED Calculator | Scientist's Toolkit",
            desc: "Convert animal doses to Human Equivalent Dose (HED).",
            url: "https://scientisttoolkit.xyz/hed-calculator"
        },
        'help-section': {
            title: "Help & Info | Scientist's Toolkit",
            desc: "User guide and references for the toolkit.",
            url: "https://scientisttoolkit.xyz/help-section"
        },
        'comments-section': {
            title: "Comments | Scientist's Toolkit",
            desc: "Leave your feedback and questions.",
            url: "https://scientisttoolkit.xyz/comments-section"
        }
    };

    // 2. 섹션 전환 함수
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
            }

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

    // 4. 초기 접속 로직 (핵심 수정 부분)
    const urlPath = window.location.pathname.replace('/', '');
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('p') ? urlParams.get('p').replace('/', '') : urlPath;

    // 접속 경로가 비어있거나 목록에 없으면 무조건 'molarity-calc'를 실행
    if (!redirectPath || !document.getElementById(redirectPath)) {
        showSection('molarity-calc', true); // 주소를 /molarity-calc로 강제 변경하며 노출
    } else {
        showSection(redirectPath, false);
    }

    // --- 이하 기존 계산기 로직 (생략 없이 그대로 사용하세요) ---
    // [기존의 Molarity, Outlier, HED 계산 함수들을 여기에 붙여넣으세요]
});