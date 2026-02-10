document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. SAS Time Unit Converter Logic
    // ==========================================
    const timeInput = document.getElementById("time-input");
    const timeUnit = document.getElementById("time-unit");
    const convertResult = document.getElementById("convert-result");

    function convertTime() {
        const val = parseFloat(timeInput.value);
        const unit = timeUnit.value;

        if (isNaN(val)) {
            convertResult.innerHTML = "Please enter a value.";
            return;
        }

        // 기준: Day로 통일 (SAS 기준: 1년=365.25일, 1달=30.4375일)
        let days = 0;
        if (unit === "days") days = val;
        else if (unit === "weeks") days = val * 7;
        else if (unit === "months") days = val * 30.4375;
        else if (unit === "years") days = val * 365.25;

        // 변환 계산
        const resDays = days;
        const resWeeks = days / 7;
        const resMonths = days / 30.4375; // SAS Standard
        const resYears = days / 365.25;

        convertResult.innerHTML = `
            <strong>Days:</strong> ${resDays.toFixed(2)} days<br>
            <strong>Weeks:</strong> ${resWeeks.toFixed(2)} weeks<br>
            <strong>Months (SAS):</strong> ${resMonths.toFixed(2)} months<br>
            <strong>Years:</strong> ${resYears.toFixed(2)} years
        `;
    }

    timeInput.addEventListener("input", convertTime);
    timeUnit.addEventListener("change", convertTime);


    // ==========================================
    // 2. Kaplan-Meier Calculator Logic
    // ==========================================
    const sampleSizeSelect = document.getElementById("sample-size");
    const dataEntryArea = document.getElementById("data-entry-area");
    const calcBtn = document.getElementById("calc-os-btn");
    let chartInstance = null; // 차트 객체 저장용

    // 초기 테이블 생성
    generateTable(parseInt(sampleSizeSelect.value));

    // 드롭다운 변경 시 테이블 재생성
    sampleSizeSelect.addEventListener("change", function() {
        generateTable(parseInt(this.value));
    });

    function generateTable(n) {
        let html = `
            <table style="width: 100%; border-spacing: 0 5px;">
                <thead>
                    <tr style="text-align: left; font-size: 0.9rem; color: #555;">
                        <th>No.</th>
                        <th>Time</th>
                        <th>Event (0=Censor, 1=Death)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (let i = 1; i <= n; i++) {
            html += `
                <tr>
                    <td style="width: 10%; font-weight: bold;">#${i}</td>
                    <td style="width: 40%;">
                        <input type="number" class="time-val" placeholder="Time" style="width: 90%; padding: 5px;">
                    </td>
                    <td style="width: 50%;">
                        <select class="status-val" style="width: 95%; padding: 5px;">
                            <option value="1">1 (Death/Event)</option>
                            <option value="0">0 (Censored)</option>
                        </select>
                    </td>
                </tr>
            `;
        }
        html += `</tbody></table>`;
        dataEntryArea.innerHTML = html;
    }

    // [계산 버튼 클릭]
    calcBtn.addEventListener("click", function() {
        const timeInputs = document.querySelectorAll(".time-val");
        const statusInputs = document.querySelectorAll(".status-val");
        let data = [];

        // 데이터 수집
        for (let i = 0; i < timeInputs.length; i++) {
            const t = parseFloat(timeInputs[i].value);
            const s = parseInt(statusInputs[i].value);
            if (!isNaN(t)) {
                data.push({ time: t, status: s });
            }
        }

        if (data.length === 0) {
            alert("Please enter at least one time value.");
            return;
        }

        // Kaplan-Meier 알고리즘 실행
        calculateKM(data);
    });

    function calculateKM(data) {
        // 1. 시간순 정렬 (오름차순)
        data.sort((a, b) => a.time - b.time);

        let n = data.length; // 현재 Risk Set 크기
        let survivalProb = 1.0; // 초기 생존율 100%
        let results = [];
        let timePoints = [];
        let probPoints = [];

        // 0시점 추가
        results.push({ time: 0, status: '-', prob: 1.0 });
        timePoints.push(0);
        probPoints.push(1.0);

        // 고유한 시간대별로 묶어서 계산 (같은 시간에 죽은 경우 처리)
        // Group by time
        let grouped = {};
        data.forEach(d => {
            if (!grouped[d.time]) grouped[d.time] = { event: 0, censor: 0, total: 0 };
            if (d.status === 1) grouped[d.time].event++;
            else grouped[d.time].censor++;
            grouped[d.time].total++;
        });

        const times = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        let currentN = n;
        let medianTime = "Not Reached";
        let medianFound = false;

        times.forEach(t => {
            const info = grouped[t];
            const d = info.event; // 사망자 수
            
            // KM 공식: S(t) = S(t-1) * (1 - d/n)
            // d가 0이면 생존율 변화 없음
            if (d > 0) {
                survivalProb = survivalProb * (1 - (d / currentN));
            }

            // 결과 저장
            results.push({
                time: t,
                status: info.event > 0 ? "Event" : "Censor",
                prob: survivalProb
            });
            
            // 그래프용 데이터 (계단식 표현을 위해 직전 확률로 점 하나 찍고, 떨어진 확률로 점 하나 찍음)
            timePoints.push(t);
            probPoints.push(survivalProb); // Step function

            // Median Survival Time 체크 (확률이 0.5 이하로 떨어지는 첫 지점)
            if (!medianFound && survivalProb <= 0.5) {
                medianTime = t;
                medianFound = true;
            }

            // 다음 loop를 위해 n 감소 (사망자 + 중도절단자 모두 제외)
            currentN -= info.total;
        });

        // 결과 화면 표시
        displayResults(results, medianTime, timePoints, probPoints);
    }

    function displayResults(results, medianTime, timePoints, probPoints) {
        document.getElementById("os-result").style.display = "block";
        document.getElementById("median-survival").innerText = medianTime;

        const tbody = document.getElementById("km-table-body");
        tbody.innerHTML = "";

        results.forEach(row => {
            if (row.time === 0) return; // 0은 표에서 제외
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${row.time}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${row.status}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${(row.prob * 100).toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });

        drawChart(timePoints, probPoints);
    }

    function drawChart(labels, data) {
        const ctx = document.getElementById('survivalChart').getContext('2d');
        
        // 기존 차트 있으면 삭제 (중복 방지)
        if (chartInstance) {
            chartInstance.destroy();
        }

        // 계단식 그래프 데이터 변환
        // Chart.js의 stepped: true 옵션을 사용하면 간단함
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Survival Probability',
                    data: data,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    stepped: true, // ★ 계단식 그래프 설정 (Kaplan-Meier 핵심)
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: { display: true, text: 'Time' },
                        type: 'linear',
                        beginAtZero: true
                    },
                    y: {
                        title: { display: true, text: 'Probability' },
                        min: 0,
                        max: 1.05,
                        beginAtZero: true
                    }
                }
            }
        });
    }
});