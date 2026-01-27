document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(item => item.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Timer
    const hoursInput = document.getElementById('hours');
    const minutesInput = document.getElementById('minutes');
    const secondsInput = document.getElementById('seconds');
    const startTimerBtn = document.getElementById('start-timer');
    const pauseTimerBtn = document.getElementById('pause-timer');
    const resetTimerBtn = document.getElementById('reset-timer');
    const timerDisplay = document.querySelector('.timer-display');

    let timerInterval;
    let timerSeconds = 0;

    function updateTimerDisplay() {
        const h = Math.floor(timerSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (timerSeconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${h}:${m}:${s}`;
    }

    startTimerBtn.addEventListener('click', () => {
        const h = parseInt(hoursInput.value) || 0;
        const m = parseInt(minutesInput.value) || 0;
        const s = parseInt(secondsInput.value) || 0;
        timerSeconds = h * 3600 + m * 60 + s;

        if (timerSeconds > 0) {
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timerSeconds--;
                updateTimerDisplay();
                if (timerSeconds <= 0) {
                    clearInterval(timerInterval);
                    alert('Timer Finished!');
                }
            }, 1000);
        }
    });

    pauseTimerBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
    });

    resetTimerBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        hoursInput.value = '';
        minutesInput.value = '';
        secondsInput.value = '';
        timerSeconds = 0;
        updateTimerDisplay();
    });

    // Stopwatch
    const stopwatchDisplay = document.querySelector('.stopwatch-display');
    const startStopwatchBtn = document.getElementById('start-stopwatch');
    const stopStopwatchBtn = document.getElementById('stop-stopwatch');
    const resetStopwatchBtn = document.getElementById('reset-stopwatch');
    const lapStopwatchBtn = document.getElementById('lap-stopwatch');
    const lapsList = document.querySelector('.laps');

    let stopwatchInterval;
    let stopwatchStartTime = 0;
    let stopwatchElapsedTime = 0;

    function formatStopwatchTime(time) {
        const h = Math.floor(time / 3600000).toString().padStart(2, '0');
        const m = Math.floor((time % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((time % 60000) / 1000).toString().padStart(2, '0');
        const ms = (time % 1000).toString().padStart(3, '0');
        return `${h}:${m}:${s}.${ms}`;
    }

    startStopwatchBtn.addEventListener('click', () => {
        if (!stopwatchInterval) {
            stopwatchStartTime = Date.now() - stopwatchElapsedTime;
            stopwatchInterval = setInterval(() => {
                stopwatchElapsedTime = Date.now() - stopwatchStartTime;
                stopwatchDisplay.textContent = formatStopwatchTime(stopwatchElapsedTime);
            }, 10);
        }
    });

    stopStopwatchBtn.addEventListener('click', () => {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    });

    resetStopwatchBtn.addEventListener('click', () => {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        stopwatchElapsedTime = 0;
        stopwatchDisplay.textContent = '00:00:00.000';
        lapsList.innerHTML = '';
    });

    lapStopwatchBtn.addEventListener('click', () => {
        if (stopwatchInterval) {
            const lapTime = stopwatchDisplay.textContent;
            const li = document.createElement('li');
            li.textContent = lapTime;
            lapsList.prepend(li);
        }
    });

    // World Clock
    const citySelect = document.getElementById('city-select');
    const clocksContainer = document.getElementById('clocks-container');
    let worldClockInterval;

    function updateWorldClocks() {
        clocksContainer.innerHTML = '';
        const selectedOptions = Array.from(citySelect.selectedOptions);
        
        selectedOptions.forEach(option => {
            const timeZone = option.value;
            const cityName = option.textContent;
            const date = new Date();
            const timeString = date.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const clockDiv = document.createElement('div');
            clockDiv.classList.add('clock');
            
            const cityEl = document.createElement('div');
            cityEl.classList.add('clock-city');
            cityEl.textContent = cityName;

            const timeEl = document.createElement('div');
            timeEl.classList.add('clock-time');
            timeEl.textContent = timeString;

            clockDiv.appendChild(cityEl);
            clockDiv.appendChild(timeEl);
            clocksContainer.appendChild(clockDiv);
        });
    }

    citySelect.addEventListener('change', updateWorldClocks);
    
    function startWorldClock() {
        clearInterval(worldClockInterval);
        updateWorldClocks();
        worldClockInterval = setInterval(updateWorldClocks, 1000);
    }
    
    startWorldClock();
    
    // Allow multiple selections on the city list
    citySelect.multiple = true;
    
    // Adjust the size of the select box to show more options
    citySelect.size = citySelect.options.length;


    // Alarm
    const alarmTimeInput = document.getElementById('alarm-time');
    const setAlarmBtn = document.getElementById('set-alarm');
    const alarmsList = document.querySelector('.alarms-list');
    let alarms = [];

    function renderAlarms() {
        alarmsList.innerHTML = '';
        alarms.forEach((alarm, index) => {
            const li = document.createElement('li');
            li.textContent = alarm.time;
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                alarms.splice(index, 1);
                renderAlarms();
            });
            li.appendChild(deleteBtn);
            alarmsList.appendChild(li);
        });
    }

    setAlarmBtn.addEventListener('click', () => {
        const time = alarmTimeInput.value;
        if (time) {
            alarms.push({ time, active: true });
            renderAlarms();
            alarmTimeInput.value = '';
        }
    });

    setInterval(() => {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        alarms.forEach(alarm => {
            if (alarm.active && alarm.time === currentTime) {
                alert('Alarm!');
                alarm.active = false; // Deactivate alarm after it goes off
            }
        });
    }, 1000);
});