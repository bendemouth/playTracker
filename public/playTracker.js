let playTracker = {
    'playNumber': [],
    'playSituation': [],
    'players': [],
    'playAction': [],
    'playResult': [],
    'opponent': []
};

let playNumber = 0;

// Add event listener for situation selection
document.getElementById('situation-select').addEventListener('change', function() {
    updateActionMenu(this.value);
})

// Update play action menu based on situation selection
function updateActionMenu(situation) {

    const actionSelect = document.getElementById('action-select');
    actionSelect.innerHTML = '';

    let options = [];

    if (situation === 'half-court') {
        options = [
            {value: 'default', text: 'Select Action...'},
            {value: 'horns', text: 'Horns'},
            {value: 'pick-roll', text: 'Pick and Roll'},
            {value: 'point', text: 'Point'},
            {value: 'dho', text: 'Dribble Hand-Off'},
            {value: 'post-entry', text: 'Post Entry'}
        ]
    }
    
    else if (situation === 'fast-break') {
        options = [
            {value: 'default', text: 'Select Action...'},
            {value: 'drag', text: 'Drag Screen'},
            {value: 'pass-ahead', text: 'Pass Ahead'},
            {value: 'paint-touch', text: 'Paint Touch'}
        ]
    }

    else {
        options = [{
            value: 'default', text: 'Select Action...'}]
    }

    options.forEach((option) => {
        let opt = document.createElement('option');

        opt.value = option.value;
        opt.text = option.text;

        actionSelect.appendChild(opt);
    });

    actionSelect.value = 'default';

}


// Add a play to the tracker

function addPlay() {
    let action = document.getElementById('action-select').value;

    let playOutcome = document.getElementById('outcome-select').value;

    let situation = document.getElementById('situation-select').value;

    let opponent = document.getElementById('opponent-select').value;

    console.log(action, playOutcome, situation); // Debugging
    
    if (action === 'default' || playOutcome === 'default' || situation === 'default') {
        document.getElementById('display').innerHTML = `
        <div class="container mt-5">
        <h4>Please select an action and play outcome</h4>
        </div>
        `;

        return;
    }

    else{

    playNumber+=1;

    let selectedPlayers = [];

    document.querySelectorAll("#player-select input[type=checkbox]:checked").forEach((checkbox) => {
        selectedPlayers.push(checkbox.value)
    });

    playTracker['playNumber'].push(playNumber);

    playTracker['playSituation'].push(situation);

    playTracker['players'].push(selectedPlayers);

    playTracker['playAction'].push(action);

    playTracker['playResult'].push(playOutcome);

    playTracker['opponent'].push(opponent);

    const playData = {
        playNumber: playNumber,
        playSituation: situation,
        players: selectedPlayers,
        playAction: action,
        playResult: playOutcome,
        opponent: opponent
    };

    console.log(playData); // Debugging

    // Add play to database (IMPORTANT)
    fetch('https://pell-city.bestfitsportsdata.com/api/plays', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(playData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })    
    .then(data => {
        console.log('Success:', data);
        document.getElementById('display').innerHTML = `
            <div class="container mt-5">
            <h4>Play ${playNumber} added successfully!</h4>
            </div>`;
    })
    .catch((error) => {
        console.error('Error:', error);
    });

    document.getElementById('situation-select').value = 'default';

    document.getElementById('action-select').value = 'default';

    document.querySelectorAll("#player-select input[type=checkbox]:checked").forEach((checkbox) => {
        checkbox.checked = false
    })

    document.getElementById('outcome-select').value = 'default';

    }

}

// Remove the last play from the tracker
function removePlay() {
    if (playTracker['playNumber'].length === 0) {
        document.getElementById('display').innerHTML = `
        <div class="container mt-5">
        <h4>No plays to remove!</h4>
        <h6>Contact Ben DeMouth for assistance with deleting older plays.</h6>
        </div>
        `;
        return;
    }

    fetch(`https://pell-city.bestfitsportsdata.com:25571/api/plays`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        playNumber-=1;

        playTracker['playNumber'].pop();
        playTracker['playSituation'].pop();
        playTracker['players'].pop();
        playTracker['playAction'].pop();
        playTracker['playResult'].pop();
        playTracker['opponent'].pop();

        document.getElementById('display').innerHTML = `
        <div class="container mt-5">
        <h4>Play removed successfully!</h4>
        </div>
        `;
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// View the plays in the tracker
function viewPlays() {

    let trackerDisplay = `
    <table class="table table-striped">
        <tr>
            <th>Play Number</th>
            <th>Situation</th>
            <th>Players Involved</th>
            <th>Action</th>
            <th>Result</th>
        </tr>
        <tbody>
    `;

    const playNumbers = playTracker['playNumber'];
    const playSituation = playTracker['playSituation'];
    const playersInvolved = playTracker['players'];
    const actionsUsed = playTracker['playAction'];
    const playResult = playTracker['playResult'];
    const opponents = playTracker['opponent'];
    for (let i=0; i < playNumbers.length; i++) {
        trackerDisplay += `
        <tr>
            <td>${playNumbers[i]}</td>
            <td>${playSituation[i]}</td>
            <td>${playersInvolved[i].join(', ')}</td>
            <td>${actionsUsed[i]}</td>
            <td>${playResult[i]}</td>
            <td>${opponents[i]}</td>
        </tr>

        `;
    }

    trackerDisplay += `
        </tbody>
    </table>
    `;
    
    document.getElementById('display').innerHTML = `
    <div class="container mt-5">
    <h3>Plays</h3>
    ${trackerDisplay}
    </div>
    `;    

}

// Get action averages
function pointsPerAction() {

    let actionAverages = {
        'horns': [],
        'pick-roll': [],
        'point': [],
        'drag': [],
        'pass-ahead': [],
        'paint-touch': [],
        'dho': [],
        'post-entry': []
    };

    for (let i=0; i < playTracker['playNumber'].length; i++) {

        if (playTracker['playAction'][i] === 'horns') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['horns'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['horns'].push(0);
            }

        }

        if (playTracker['playAction'][i] === 'pick-roll') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['pick-roll'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['pick-roll'].push(0);
            }

        }

        if (playTracker['playAction'][i] === 'point') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['point'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['point'].push(0);
            }

        }

        if (playTracker['playAction'][i] === 'drag') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['drag'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['drag'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'pass-ahead') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['pass-ahead'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['pass-ahead'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'paint-touch') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['paint-touch'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['paint-touch'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'dho') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['dho'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['dho'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'post-entry') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['post-entry'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['post-entry'].push(0);
            }
        }

    }     

    for (let action in actionAverages) {
        let actionSum = actionAverages[action].reduce((sum, value) => sum + value, 0);

        let playsRan = actionAverages[action].length;

        actionAverages[action] = playsRan ? (actionSum / playsRan).toFixed(2) : 0;
    }

    return actionAverages
}


// Display the average points per action
function displayAveragesByPlay() {
    const actionAverages = pointsPerAction();

    document.getElementById('display').innerHTML = `
    <div class="container mt-5">
    <h3>Half-Court Points per Action</h3>
    <table id="halfCourtTable" class="table table-striped">
        <thead>
            <tr>
                <th role="columnheader">Action</th>
                <th role="columnheader">Points per Action</th>
            </tr>
        </thead>
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
            <tr class='table' style="background-color: orange;">
                <td>Dribble Hand-Off</td>
                <td>${actionAverages['dho']}</td>
            </tr>
            <tr class='table-light'>
                <td>Post Entry</td>
                <td>${actionAverages['post-entry']}</td>
            </tr>
        </tbody>
    </table>

    <h3>Fast Break Points per Action</h3>
    <table id="fastBreakTable" class="table table-striped">
        <thead>
            <tr>
                <th role="columnheader">Action</th>
                <th role="columnheader">Points per Action</th>
            </tr>
        </thead>
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

    // Initialize Tablesort
    new Tablesort(document.getElementById('halfCourtTable'));
    new Tablesort(document.getElementById('fastBreakTable'));
}

// Get average points per player
function pointsPerPlayer() {
    let playerAverages = {
        loganPreuss: [],
        sawyerGinn: [],
        treyKuz: [],
        ethanIsbell: [],
        tylerKuz: [],
        tjSanders: [],
        haganCalvin: [],
        brodyGossett: [],
        jemarcClegg: [],
        connorChandler: [],
        elliotHuckaby: [],
        khaliThompson: [],
        jjHamby: [],
        eliBeckett: []
    };


    for (let i= 0; i < playTracker['playNumber'].length; i++) {

        let playResult = playTracker['playResult'][i] !== 'turnover' ? parseInt(playTracker['playResult'][i]) : 0;

        if (playTracker['players'][i].includes('logan-preuss')) {
            playerAverages['loganPreuss'].push(playResult);
        }

        if (playTracker['players'][i].includes('sawyer-ginn')) {
            playerAverages['sawyerGinn'].push(playResult);
        }
        
        if (playTracker['players'][i].includes('trey-kuz')) {
            playerAverages['treyKuz'].push(playResult);
        }

        if (playTracker['players'][i].includes('ethan-isbell')) {
            playerAverages['ethanIsbell'].push(playResult);
        }

        if (playTracker['players'][i].includes('tyler-kuz')) {
            playerAverages['tylerKuz'].push(playResult);
        }

        if (playTracker['players'][i].includes('tj-sanders')) {
            playerAverages['tjSanders'].push(playResult);
        }
        
        if (playTracker['players'][i].includes('hagan-calvin')) {
            playerAverages['haganCalvin'].push(playResult);
        }

        if (playTracker['players'][i].includes('brody-gossett')) {
            playerAverages['brodyGossett'].push(playResult);
        }

        if (playTracker['players'][i].includes('jemarc-clegg')) {
            playerAverages['jemarcClegg'].push(playResult);
        }

        if (playTracker['players'][i].includes('connor-chandler')) {
            playerAverages['connorChandler'].push(playResult);
        }

        if (playTracker['players'][i].includes('elliot-huckaby')) {
            playerAverages['elliotHuckaby'].push(playResult);
        }

        if (playTracker['players'][i].includes('khali-thompson')) {
            playerAverages['khaliThompson'].push(playResult);
        }

        if (playTracker['players'][i].includes('jj-hamby')) {
            playerAverages['jjHamby'].push(playResult);
        }

        if (playTracker['players'][i].includes('eli-beckett')) {
            playerAverages['eliBeckett'].push(playResult);
        }
    }

    for (let player in playerAverages) {

        let sumPoints = playerAverages[player].reduce((sum, points) => sum + points, 0);

        let playsInvolvedIn = playerAverages[player].length;

        playerAverages[player] = playsInvolvedIn ? (sumPoints / playsInvolvedIn).toFixed(2) : 0;

    }

    return playerAverages;
}

// Display the average points per player
function displayAveragesByPlayer() {
    const playerAverages = pointsPerPlayer();

    document.getElementById('display').innerHTML = `
    <div class="container mt-5">
    <h3>Average Points per Player</h3>
    <table id="playerTable" class="table table-striped">
        <thead>
            <tr>
                <th role="columnheader">Player</th>
                <th role="columnheader">Average Points</th>
            </tr>
        </thead>
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
                <td>Elliot Huckaby</td>
                <td>${playerAverages['elliotHuckaby']}</td>
            </tr>
            <tr>
                <td>Khali Thompson</td>
                <td>${playerAverages['khaliThompson']}</td>
            </tr>
            <tr>
                <td>JJ Hamby</td>
                <td>${playerAverages['jjHamby']}</td>
            </tr>
            <tr>
                <td>Eli Beckett</td>
                <td>${playerAverages['eliBeckett']}</td>
            </tr>
        </tbody>
    </table>
    </div>
    `;

    // Initialize Tablesort
    new Tablesort(document.getElementById('playerTable'));
}