document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. SAS Time Unit Converter (여백 극소화)
    // ==========================================
    const timeInput = document.getElementById("time-input");
    const timeUnit = document.getElementById("time-unit");
    const convertResult = document.getElementById("convert-result");

    function convertTime() {
        if (!timeInput || !timeUnit || !convertResult) return;

        const val = parseFloat(timeInput.value);
        const unit = timeUnit.value;

        // ★ 결과창 박스 자체의 패딩을 5px로 줄임 (!important 강제 적용)
        convertResult.setAttribute("style", "padding: 5px 10px !important; min-height: 0 !important; background: #f8f9fa; border: 1px solid #eee; border-radius: 5px; margin-top: 5px;");

        if (isNaN(val)) {
            convertResult.innerHTML = "<div style='color:#888; font-size:0.85rem; margin:0;'>Please enter a value.</div>";
            return;
        }

        let days = 0;
        if (unit === "days") days = val;
        else if (unit === "weeks") days = val * 7;
        else if (unit === "months") days = val * 30.4375;
        else if (unit === "years") days = val * 365.25;

        // ★ 내부 텍스트 줄 간격(gap)을 2px로 줄이고 글자 크기를 조금 더 줄임
        convertResult.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0;">
                <p style="margin: 0; line-height: 1.2; font-size: 0.9rem;"><strong>Days:</strong> ${days.toFixed(2)}</p>
                <p style="margin: 0; line-height: 1.2; font-size: 0.9rem;"><strong>Weeks:</strong> ${(days / 7).toFixed(2)}</p>
                <p style="margin: 0; line-height: 1.2; font-size: 0.9rem; color: #0056b3;"><strong>Months (SAS):</strong> ${(days / 30.4375).toFixed(2)}</p>
                <p style="margin: 0; line-height: 1.2; font-size: 0.9rem;"><strong>Years:</strong> ${(days / 365.25).toFixed(2)}</p>
            </div>
        `;
    }

    if(timeInput) timeInput.addEventListener("input", convertTime);
    if(timeUnit) timeUnit.addEventListener("change", convertTime);


    // ==========================================
    // 2. Multi-Group Kaplan-Meier Logic
    // ==========================================
    const numGroupsSelect = document.getElementById("num-groups");
    const groupsWrapper = document.getElementById("groups-wrapper");
    const calcBtn = document.getElementById("calc-os-btn");
    
    let chartInstance = null;

    if(numGroupsSelect) {
        createGroupInputs(parseInt(numGroupsSelect.value));
        numGroupsSelect.addEventListener("change", function() {
            createGroupInputs(parseInt(this.value));
        });
    }

    function createGroupInputs(num) {
        let html = "";
        for (let g = 1; g <= num; g++) {
            const defaultName = g === 1 && num === 2 ? "Control" : (g === 2 && num === 2 ? "Treatment" : `Group ${g}`);
            
            html += `
            <div class="group-container" id="group-box-${g}" style="margin-bottom: 10px; background: #f8f9fa; padding: 8px; border-radius: 5px; border: 1px solid #eee;">
                <div class="group-header" style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
                    <div>
                        <label style="font-size:0.85rem;"><strong>Group:</strong></label>
                        <input type="text" class="group-name-input" value="${defaultName}" style="padding:2px 5px; width:90px; font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="font-size:0.85rem;">N:</label>
                        <select class="group-n-select" data-group="${g}" style="padding:2px; font-size:0.85rem;">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="15">15</option>
                            <option value="20">20</option>
                            <option value="30">30</option>
                            <option value="50">50</option>
                        </select>
                    </div>
                </div>
                <div id="group-data-${g}">
                    ${generateTableRows(10, g)}
                </div>
            </div>
            `;
        }
        if(groupsWrapper) groupsWrapper.innerHTML = html;

        document.querySelectorAll(".group-n-select").forEach(select => {
            select.addEventListener("change", function() {
                const g = this.dataset.group;
                const n = parseInt(this.value);
                document.getElementById(`group-data-${g}`).innerHTML = generateTableRows(n, g);
            });
        });
    }

    function generateTableRows(n, groupId) {
        let html = `
            <table style="width: 100%; border-spacing: 0 2px;">
                <thead>
                    <tr style="text-align: left; font-size: 0.8rem; color: #666;">
                        <th style="padding-bottom:2px;">No.</th>
                        <th style="padding-bottom:2px;">Time</th>
                        <th style="padding-bottom:2px;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        for (let i = 1; i <= n; i++) {
            html += `
                <tr>
                    <td style="width: 15%; font-size:0.8rem;">#${i}</td>
                    <td style="width: 40%;">
                        <input type="number" class="time-val group-${groupId}-time" placeholder="Time" style="width: 90%; padding: 3px; font-size:0.9rem;">
                    </td>
                    <td style="width: 45%;">
                        <select class="status-val group-${groupId}-status" style="width: 95%; padding: 3px; font-size:0.9rem;">
                            <option value="1">1 (Event/Death)</option>
                            <option value="0">0 (Censored)</option>
                        </select>
                    </td>
                </tr>
            `;
        }
        html += `</tbody></table>`;
        return html;
    }

    if(calcBtn) {
        calcBtn.addEventListener("click", function() {
            const numGroups = parseInt(numGroupsSelect.value);
            const allDatasets = [];
            const medianResults = [];
            const groupNames = document.querySelectorAll(".group-name-input");
            const colors = ['#007bff', '#dc3545', '#28a745', '#fd7e14']; 

            for (let g = 1; g <= numGroups; g++) {
                const timeInputs = document.querySelectorAll(`.group-${g}-time`);
                const statusInputs = document.querySelectorAll(`.group-${g}-status`);
                const groupName = groupNames[g-1].value;
                let data = [];

                for (let i = 0; i < timeInputs.length; i++) {
                    const t = parseFloat(timeInputs[i].value);
                    const s = parseInt(statusInputs[i].value);
                    if (!isNaN(t)) {
                        data.push({ time: t, status: s });
                    }
                }

                if (data.length === 0) continue;

                const kmResult = calculateSingleKM(data);
                
                allDatasets.push({
                    label: groupName,
                    data: kmResult.points,
                    borderColor: colors[(g-1) % 4],
                    backgroundColor: colors[(g-1) % 4],
                    borderWidth: 2,
                    fill: false,       
                    stepped: true,     
                    tension: 0,
                    pointRadius: 2,
                    pointHoverRadius: 5
                });

                medianResults.push({ name: groupName, median: kmResult.median, color: colors[(g-1) % 4] });
            }

            if (allDatasets.length === 0) {
                alert("Please enter data for at least one group.");
                return;
            }

            displayResults(medianResults, allDatasets);
        });
    }

    function calculateSingleKM(data) {
        data.sort((a, b) => a.time - b.time);
        let n = data.length;
        let survivalProb = 1.0;
        let points = [{x: 0, y: 1.0}]; 
        
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
            const d = info.event;
            
            if (d > 0) {
                survivalProb = survivalProb * (1 - (d / currentN));
            }

            points.push({ x: t, y: survivalProb });

            if (!medianFound && survivalProb <= 0.5) {
                medianTime = t;
                medianFound = true;
            }
            currentN -= info.total;
        });
        
        return { median: medianTime, points: points };
    }

    function displayResults(medianResults, datasets) {
        const resultDiv = document.getElementById("os-result");
        if(!resultDiv) return;

        // ★ [핵심 1] 결과창 전체 여백 확 줄임 (padding 10px)
        resultDiv.setAttribute("style", "display: block; margin-top: 15px; padding: 10px; border: 1px solid #eee; background: #fff; border-radius: 8px;");

        // Median Table
        let medianHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <tr style="background:#f1f1f1; border-bottom:1px solid #ccc;">
                    <th style="padding:4px 8px; text-align:left;">Group</th>
                    <th style="padding:4px 8px; text-align:left;">Median Survival</th>
                </tr>
        `;
        medianResults.forEach(res => {
            medianHtml += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:4px 8px; font-weight:bold; color:${res.color};">${res.name}</td>
                    <td style="padding:4px 8px;">${res.median}</td>
                </tr>
            `;
        });
        medianHtml += `</table>`;

        // ★ [핵심 2] gap을 10px로 줄이고, 버튼에 고유 ID(btn-download-final) 부여
        resultDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                
                <h3 style="margin: 0; font-size: 1rem; color: #333; border-bottom: none; padding-bottom: 0;">📊 Analysis Result</h3>
                
                <div style="margin: 0;">${medianHtml}</div>

                <div style="position: relative; height: 300px; width: 100%; margin: 0;">
                    <canvas id="survivalChart"></canvas>
                </div>
                
                <div style="text-align: right; margin: 0;">
                    <button id="btn-download-final" type="button" style="
                        background-color: #2c3e50; 
                        color: white; 
                        border: none; 
                        padding: 5px 10px; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        font-size: 0.8rem; 
                        font-weight: 500; 
                        display: inline-flex; 
                        align-items: center; 
                        gap: 5px;
                    ">
                        <span>📥</span> Download Graph
                    </button>
                </div>
            </div>
        `;

        // 차트 그리기
        drawChart(datasets);

        // ★ [핵심 3] 다운로드 버튼 이벤트 리스너 직접 연결 (가장 확실한 방법)
        setTimeout(() => {
            const dlBtn = document.getElementById("btn-download-final");
            if (dlBtn) {
                // 기존 리스너 제거 후 새로 추가 (중복 방지)
                const newBtn = dlBtn.cloneNode(true);
                dlBtn.parentNode.replaceChild(newBtn, dlBtn);
                
                newBtn.addEventListener("click", function() {
                    downloadChartImage();
                });
            }
        }, 100);
    }

    function drawChart(datasets) {
        const ctx = document.getElementById('survivalChart').getContext('2d');
        const xLabelInput = document.getElementById('xaxis-label');
        const xLabel = xLabelInput ? (xLabelInput.value || "Time") : "Time";

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: 0 },
                plugins: {
                    title: {
                        display: true,
                        text: 'Kaplan-Meier Survival Curve',
                        font: { size: 14 },
                        padding: { top: 0, bottom: 5 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(1) + '%';
                            }
                        }
                    },
                    legend: {
                        position: 'top', 
                        align: 'end',
                        labels: { boxWidth: 10, padding: 8, font: { size: 11 } }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: xLabel, font: {weight:'bold', size: 11} },
                        beginAtZero: true
                    },
                    y: {
                        title: { display: true, text: 'Survival Prob.', font: {weight:'bold', size: 11} },
                        min: 0, max: 1.05, beginAtZero: true
                    }
                }
            }
        });
    }

    // 다운로드 실행 함수
    function downloadChartImage() {
        const canvas = document.getElementById('survivalChart');
        if(!canvas) {
            alert("Chart not found.");
            return;
        }

        try {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            
            // 흰색 배경 채우기
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 이미지 그리기
            tempCtx.drawImage(canvas, 0, 0);
            
            // 다운로드
            const link = document.createElement('a');
            link.download = 'survival-curve.png';
            link.href = tempCanvas.toDataURL('image/png', 1.0);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error(e);
            alert("Download failed.");
        }
    }
});