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
        document.getElementById('display').innerHTML = `
        <div class="alert alert-danger" role="alert">
            Error fetching data: ${error.message}
        </div>
        `;
    }
});


function getAveragesByPlayType() {
    let actionAverages = {
        'horns': [],
        'pick-roll': [],
        'point': [],
        'drag': [],
        'pass-ahead': [],
        'paint-touch': []
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

        if (data[i]['play-action'] === 'point') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['point'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['point'].push(0);
            }
        }

        if (data[i]['play-action'] === 'drag') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['drag'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['drag'].push(0);
            }
        }

        if (data[i]['play-action'] === 'pass-ahead') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['pass-ahead'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['pass-ahead'].push(0);
            }
        }

        if (data[i]['play-action'] === 'paint-touch') {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                actionAverages['paint-touch'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                actionAverages['paint-touch'].push(0);
            }
        }

    }

    for (let action in actionAverages) {
        if (actionAverages[action].length === 0) {
            actionAverages[action] = 0;  // Set to 0 if array is empty
        } else {
            let actionSum = actionAverages[action].reduce((sum, value) => sum + value, 0);
            actionAverages[action] = (actionSum / actionAverages[action].length).toFixed(2);
        }
    }
    

    return actionAverages;
}

function displayAveragesByPlayType() {
    const actionAverages = getAveragesByPlayType();

    document.getElementById('display').innerHTML = `
    <div class="container mt-5">
    <h3>Half-Court Averages</h3>
    <table class="table table-striped">
        <tr>
            <th>Action</th>
            <th>Average Points</th>
        </tr>
        <tbody>
            <tr class='table-warning'>
                <td>Horns</td>
                <td>${actionAverages['horns']}</td>
            </tr>
            <tr class='table-primary'>
                <td>Pick & Roll</td>
                <td>${actionAverages['pick-roll']}</td>
            </tr>
            <tr class='table-success'>
                <td>Point</td>
                <td>${actionAverages['point']}</td>
            </tr>
        </tbody>
    </table>

    <h3>Fast Break Averages</h3>
    <table class="table table-striped">
        <tr>
            <th>Action</th>
            <th>Average Points</th>
        </tr>
        <tbody>
            <tr class='table-info'>
                <td>Drag</td>
                <td>${actionAverages['drag']}</td>
            </tr>
            <tr class='table-secondary'>
                <td>Pass Ahead</td>
                <td>${actionAverages['pass-ahead']}</td>
            </tr>
            <tr class='table-danger'>
                <td>Paint Touch</td>    
                <td>${actionAverages['paint-touch']}</td>
            </tr>
        </tbody>
    </table>
    </div>
    `;
}


function getAveragesByPlayer() {
    let playerAverages = {
        'loganPreuss': [],
        'sawyerGinn': [],
        'djVerges': [],
        'treyKuz': [],
        'ethanIsbell': [],
        'tylerKuz': [],
        'tjSanders': [],
        'haganCalvin': [],
        'brodyGossett': [],
        'jemarcClegg': [],
        'connorChandler': [],
        'tristanAnderson': [],
        'elliotHuckaby': [],
        'khaliThompson': [],
        'jordanWoods': []
    };

    for (let i = 0; i < data.length; i++) {
        
        if (data[i]['players-involved'].includes('logan-preuss')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['loganPreuss'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['loganPreuss'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('sawyer-ginn')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['sawyerGinn'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['sawyerGinn'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('dj-verges')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['djVerges'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['djVerges'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('trey-kuz')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['treyKuz'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['treyKuz'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('ethan-isbell')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['ethanIsbell'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['ethanIsbell'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('tyler-kuz')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['tylerKuz'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['tylerKuz'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('tj-sanders')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['tjSanders'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['tjSanders'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('hagan-calvin')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['haganCalvin'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['haganCalvin'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('brody-gossett')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['brodyGossett'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['brodyGossett'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('jemarc-clegg')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['jemarcClegg'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['jemarcClegg'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('connor-chandler')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['connorChandler'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['connorChandler'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('tristan-anderson')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['tristanAnderson'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['tristanAnderson'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('elliot-huckaby')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['elliotHuckaby'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['elliotHuckaby'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('khali-thompson')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['khaliThompson'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['khaliThompson'].push(0);
            }
        }

        if (data[i]['players-involved'].includes('jordan-woods')) {
            if (data[i]['play-result'] !== 'turnover' && data[i]['play-result'] !== 'end-of-period') {
                playerAverages['jordanWoods'].push(parseInt(data[i]['play-result']));
            } else if (data[i]['play-result'] === 'turnover' || data[i]['play-result'] === 'end-of-period' ) {
                playerAverages['jordanWoods'].push(0);
            }
        }
    }


    for (let player in playerAverages) {
        if (playerAverages[player].length === 0) {
            playerAverages[player] = 0;  // Set to 0 if array is empty
        } else {
            let sumPoints = playerAverages[player].reduce((a, b) => a + b, 0);
            playerAverages[player] = (sumPoints / playerAverages[player].length).toFixed(2);
        }
    }
    

    return playerAverages
}

function displayAveragesByPlayer() {

    const playerAverages = getAveragesByPlayer();



    document.getElementById('display').innerHTML = `
    <div class="container mt-5">
    <h3>Average Points per Player</h3>
    <table class="table table-striped">
        <tr>
            <th>Player</th>
            <th>Average Points</th>
        </tr>
        <tbody>
            <tr>
                <td>Logan Preuss</td>
                <td>${playerAverages['loganPreuss']}</td>
            </tr>
            <tr>
                <td>Sawyer Ginn</td>
                <td>${playerAverages['sawyerGinn']}</td>
            </tr>
            <tr>
                <td>DJ Verges</td>
                <td>${playerAverages['djVerges']}</td>
            </tr>
            <tr>
                <td>Trey Kuz</td>
                <td>${playerAverages['treyKuz']}</td>
            </tr>
            <tr>
                <td>Ethan Isbell</td>
                <td>${playerAverages['ethanIsbell']}</td>
            </tr>
            <tr>
                <td>Tyler Kuz</td>
                <td>${playerAverages['tylerKuz']}</td>
            </tr>
            <tr>
                <td>TJ Sanders</td>
                <td>${playerAverages['tjSanders']}</td>
            </tr>
            <tr>
                <td>Hagan Calvin</td>
                <td>${playerAverages['haganCalvin']}</td>
            </tr>
            <tr>
                <td>Brody Gossett</td>
                <td>${playerAverages['brodyGossett']}</td>
            </tr>
            <tr>
                <td>Jemarc Clegg</td>
                <td>${playerAverages['jemarcClegg']}</td>
            </tr>
            <tr>
                <td>Connor Chandler</td>
                <td>${playerAverages['connorChandler']}</td>
            </tr>
            <tr>
                <td>Tristan Anderson</td>
                <td>${playerAverages['tristanAnderson']}</td>
            </tr>
            <tr>
                <td>Elliot Huckaby</td>
                <td>${playerAverages['elliotHuckaby']}</td>
            </tr>
            <tr>
                <td>Khali Thompson</td>
                <td>${playerAverages['khaliThompson']}</td>
            </tr>
            <tr>
                <td>Jordan Woods</td>
                <td>${playerAverages['jordanWoods']}</td>
            </tr>
        </tbody>
    </table>
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
        if (situationAverages[situation].length === 0) {
            situationAverages[situation] = 0;  // Set to 0 if array is empty
        } else {
            let sumPoints = situationAverages[situation].reduce((a, b) => a + b, 0);
            situationAverages[situation] = (sumPoints / situationAverages[situation].length).toFixed(2);
        }
    }
    

    return situationAverages
}

function displayAveragesBySituation(){

    const situationAverages = getAveragesBySituation();


    document.getElementById('display').innerHTML = `
    <div class="container mt-5">
    <h3>Averages by Situation</h3>
    <table class="table table-striped">
        <tr>
            <th>Situation</th>
            <th>Average Points</th>
        </tr>
        <tbody>
            <tr>
                <td>Half-Court</td>
                <td>${situationAverages['halfcourt']}</td>
            </tr>
            <tr>
                <td>Fast Break</td>
                <td>${situationAverages['fastbreak']}</td>
            </tr>
        </tbody>
    </table>
    </div>
    `;
}