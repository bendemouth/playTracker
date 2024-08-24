let playTracker = {
    'playNumber': [],
    'playSituation': [],
    'players': [],
    'playAction': [],
    'playResult': [],
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
            {value: 'pick-pop', text: 'Pick and Pop'},
            {value: 'elevator', text: 'Elevator'},
            {value: 'flare', text: 'Flare'}
        ]
    }
    
    else if (situation === 'fast-break') {
        options = [
            {value: 'default', text: 'Select Action...'},
            {value: 'paint-layup', text: 'Drive to Paint + Layup'},
            {value: 'paint-kick', text: 'Drive to Paint + Kick'},
            {value: 'pass-ahead-layup', text: 'Pass Ahead for Layup'},
            {value: 'pass-ahead-jumper', text: 'Pass Ahead for Jumper'}
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

    console.log(action, playOutcome, situation); // Debugging
    
    if (action === 'default' || playOutcome === 'default' || situation === 'default') {
        document.getElementById('display').innerHTML = `
        <div class="container mt-12">
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

    const playData = {
        playNumber: playNumber,
        playSituation: situation,
        players: selectedPlayers,
        playAction: action,
        playResult: playOutcome
    };

    console.log(playData); // Debugging

    // Add play to database (IMPORTANT)
    fetch('http://pell-city.bestfitsportsdata.com/api/plays', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(playData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        document.getElementById('display').innerHTML = `
            <div class="container mt-12">
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
    playNumber-=1;

    playTracker['playNumber'].pop();
    playTracker['playSituation'].pop();
    playTracker['players'].pop();
    playTracker['playAction'].pop();
    playTracker['playResult'].pop();

    document.getElementById('display').innerHTML = `
    <div class="container mt-12">
    <h4>Play removed successfully!</h4>
    </div>
    `;

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

    for (let i=0; i < playNumbers.length; i++) {
        trackerDisplay += `
        <tr>
            <td>${playNumbers[i]}</td>
            <td>${playSituation[i]}</td>
            <td>${playersInvolved[i].join(', ')}</td>
            <td>${actionsUsed[i]}</td>
            <td>${playResult[i]}</td>
        </tr>

        `;
    }

    trackerDisplay += `
        </tbody>
    </table>
    `;
    
    document.getElementById('display').innerHTML = `
    <div class="container mt-12">
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
        'pick-pop': [],
        'elevator': [],
        'flare': [],
        'paint-layup': [],
        'paint-kick': [],
        'pass-ahead-layup': [],
        'pass-ahead-jumper': []
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

        if (playTracker['playAction'][i] === 'pick-pop') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['pick-pop'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['pick-pop'].push(0);
            }

        }

        if (playTracker['playAction'][i] === 'elevator') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['elevator'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['elevator'].push(0);
            }

        }

        if (playTracker['playAction'][i] === 'flare') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['flare'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['flare'].push(0);
            }

        }

        if (playTracker['playAction'][i] === 'paint-layup') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['paint-layup'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['paint-layup'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'paint-kick') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['paint-kick'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['paint-kick'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'pass-ahead-layup') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['pass-ahead-layup'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['pass-ahead-layup'].push(0);
            }
        }

        if (playTracker['playAction'][i] === 'pass-ahead-jumper') {
            if (playTracker['playResult'][i] !== 'turnover' && playTracker['playResult'][i] !== 'end-of-period') {
                actionAverages['pass-ahead-jumper'].push(parseInt(playTracker['playResult'][i]));
            }

            else if (playTracker['playResult'][i] === 'turnover' || playTracker['playResult'][i] === 'end-of-period') {
                actionAverages['pass-ahead-jumper'].push(0);
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
    <div class="container mt-12">
    <h3>Average Points per Action</h3>
    <h6>Half-Court</h6>
    <p>
        Horns: ${actionAverages['horns']} point(s) per action<br>
        Pick & Rolls: ${actionAverages['pick-roll']} point(s) per action<br>
        Pick & Pops: ${actionAverages['pick-pop']} point(s) per action<br>
        Elevators: ${actionAverages['elevator']} point(s) per action<br>
        Flares: ${actionAverages['flare']} point(s) per action<br>
    </p>

    <h6>Fast Break</h6>
    <p>
        Drive for Layup: ${actionAverages['paint-layup']} point(s) per action<br>
        Drive and Kick: ${actionAverages['paint-kick']} point(s) per action<br>
        Pass Ahead for Layup: ${actionAverages['pass-ahead-layup']} point(s) per action<br>
        Pass Ahead for Jumper: ${actionAverages['pass-ahead-jumper']} point(s) per action<br>
    </p>
    </div>
    
    `;
}

// Get average points per player
function pointsPerPlayer() {
    let playerAverages = {
        playerOne: [],
        playerTwo: [],
        playerThree: [],
        playerFour: [],
        playerFive: [],
        playerSix: [],
        playerSeven: [],
        playerEight: [],
        playerNine: [],
        playerTen: [],
        playerEleven: [],
        playerTwelve: []
    };


    for (let i= 0; i < playTracker['playNumber'].length; i++) {

        let playResult = playTracker['playResult'][i] !== 'turnover' ? parseInt(playTracker['playResult'][i]) : 0;

        if (playTracker['players'][i].includes('player-1')) {
            playerAverages['playerOne'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-2')) {
            playerAverages['playerTwo'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-3')) {
            playerAverages['playerThree'].push(playResult);
        }
        
        if (playTracker['players'][i].includes('player-4')) {
            playerAverages['playerFour'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-5')) {
            playerAverages['playerFive'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-6')) {
            playerAverages['playerSix'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-7')) {
            playerAverages['playerSeven'].push(playResult);
        }
        
        if (playTracker['players'][i].includes('player-8')) {
            playerAverages['playerEight'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-9')) {
            playerAverages['playerNine'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-10')) {
            playerAverages['playerTen'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-11')) {
            playerAverages['playerEleven'].push(playResult);
        }

        if (playTracker['players'][i].includes('player-12')) {
            playerAverages['playerTwelve'].push(playResult);
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

    let displayTop = '<table><tr><th>Player</th><th>Average Points</th></tr>';
    let displayBottom = '</table>';

    for (let player in playerAverages) {
        displayTop += `<tr><td>${player}</td><td>${playerAverages[player]}</td></tr>`;
    }

    document.getElementById('display').innerHTML = `
    <div class="container mt-12">
    <h3>Average Points per Player</h3>
    ${displayTop}
    ${displayBottom}
    </div>

    `;
}