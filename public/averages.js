let data = [];

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Fetch data from API
        const response = await fetch("http://localhost:25571/api/plays");
        
        // Check HTTP response
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        data = await response.json();

        // Log returned data
        console.log("Fetched data:", data);

        // Process each play in the data array
        data.forEach(play => {
            // Parse the players-involved string into a JavaScript array
            const players = play['players-involved'].split(', ');
            console.log(`Play Action: ${play['play-action']}`);
            console.log(`Play Situation: ${play['play-situation']}`);
            console.log(`Play Result: ${play['play-result']}`);
            console.log(`Players Involved: ${players.join(', ')}`);
        });

    } catch (error) {
        console.error("Error fetching data:", error);
    }
});


function getAveragesByPlayType() {
    let actionAverages = {
        'horns': [],
        'pick-roll': [],
        'pick-pop': [],
        'elevator': [],
        'flare': [],
        'paint-layup': [],
        'paint-kick': [],
        'pass-ahead-layup': [],
        'pass-ahead-jumper': []
    };

    for (let i = 0; i < data.length; i++) {
        if (data[i]['play-action'] === 'horns') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['horns'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['horns'].push(0);
            }
        }

        if (data[i]['play-action'] === 'pick-roll') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['pick-roll'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['pick-roll'].push(0);
            }
        }

        if (data[i]['play-action'] === 'pick-pop') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['pick-pop'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['pick-pop'].push(0);
            }
        }

        if (data[i]['play-action'] === 'elevator') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['elevator'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['elevator'].push(0);
            }
        }

        if (data[i]['play-action'] === 'flare') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['flare'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['flare'].push(0);
            }
        }

        if (data[i]['play-action'] === 'paint-layup') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['paint-layup'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['paint-layup'].push(0);
            }
        }

        if (data[i]['play-action'] === 'paint-kick') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['paint-kick'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['paint-kick'].push(0);
            }
        }

        if (data[i]['play-action'] === 'pass-ahead-layup') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['pass-ahead-layup'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['pass-ahead-layup'].push(0);
            }
        }

        if (data[i]['play-action'] === 'pass-ahead-jumper') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['pass-ahead-jumper'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['pass-ahead-jumper'].push(0);
            }
        }
    }

    for (let action in actionAverages) {
        let actionSum = actionAverages[action].reduce((sum, value) => sum + value, 0);
        let count = actionAverages[action].length;

        actionAverages[action] = count ? (actionSum / count).toFixed(2) : 0;
    }

    return actionAverages;
}

function displayAveragesByPlayType() {
    const actionAverages = getAveragesByPlayType();

    let displayTop = '<table class="table table-striped"><tr><th>Action</th><th>Points per Action</th></tr><tbody>';
    let displayBottom = '</tbody></table>';

    for (let action in actionAverages) {
        displayTop += `<tr><td>${action}</td><td>${actionAverages[action]}</td></tr>`;
    }

    document.getElementById('display').innerHTML = `
    <div class="container mt-12">
    <h3>Average Points per Action</h3>
    ${displayTop}
    ${displayBottom}
    </div>
    `;
}


function getAveragesByPlayer() {
    let playerAverages = {
        'playerOne': [],
        'playerTwo': [],
        'playerThree': [],
        'playerFour': [],
        'playerFive': [],
        'playerSix': [],
        'playerSeven': [],
        'playerEight': [],
        'playerNine': [],
        'playerTen': [],
        'playerEleven': [],
        'playerTwelve': []
    };

    for (let i = 0; i < data.length; i++) {
        
        if (data[i]['players-involved'].includes('player-1')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerOne'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerOne'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-2')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerTwo'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerTwo'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-3')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerThree'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerThree'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-4')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerFour'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerFour'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-5')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerFive'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerFive'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-6')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerSix'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerSix'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-7')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerSeven'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerSeven'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-8')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerEight'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerEight'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-9')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerNine'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerNine'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-10')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerTen'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerTen'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-11')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerEleven'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerEleven'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('player-12')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['playerTwelve'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['playerTwelve'].push(0);
            }
        }
    }


    for (let player in playerAverages) {
        playerAverages[player] = (playerAverages[player].reduce((a, b) => a + b, 0) / playerAverages[player].length).toFixed(2);
    }

    return playerAverages
}

function displayAveragesByPlayer() {

    const playerAverages = getAveragesByPlayer();

    let displayTop = `
    <table class="table table-striped">
    <tr>
    <th>Player</th>
    <th>Average Points</th>
    </tr>
    <tbody>
    `;
    let displayBottom = '</tbody></table>';

    for (let player in playerAverages) {
        displayTop += `
        <tr>
        <td>${player}</td>
        <td>${playerAverages[player]}</td>
        </tr>
        `;
    }

    document.getElementById('display').innerHTML = `
    <div class="container mt-12">
    <h3>Average Points per Player</h3>
    ${displayTop}
    ${displayBottom}
    </div>
    `;
}

function getAveragesBySituation() {
    let situationAverages = {
        halfcourt: [],
        fastbreak: []
    };

    for (let i=0; i < data.length; i++) {
        if (data[i]['play-situation'] === 'half-court') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                situationAverages['halfcourt'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                situationAverages['halfcourt'].push(0);
            }
        }
        if (data[i]['play-situation'] === 'fast-break') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                situationAverages['fastbreak'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                situationAverages['fastbreak'].push(0);
            }
        }
    }

    for (let situation in situationAverages) {
        situationAverages[situation] = (situationAverages[situation].reduce((a, b) => a + b, 0) / situationAverages[situation].length).toFixed(2);
    }

    return situationAverages
}

function displayAveragesBySituation(){

    const situationAverages = getAveragesBySituation();

    let displayTop = `
    <table class="table table-striped">
    <tr>
    <th>Situation</th>
    <th>Average Points</th>
    </tr>
    <tbody>
    `;
    let displayBottom = '</tbody></table>';

    for (let situation in situationAverages) {
        displayTop += `
        <tr>
        <td>${situation}</td>
        <td>${situationAverages[situation]}</td>
        </tr>
        `;
    }

    document.getElementById('display').innerHTML = `
    <div class="container mt-12">
    <h3>Average Points per Situation</h3>
    ${displayTop}
    ${displayBottom}
    </div>
    `;
}