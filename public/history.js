document.getElementById('backButton').addEventListener('click', () => {
    window.location.href = 'index.html';
});

document.getElementById('searchButton').addEventListener('click', () => {
    const searchTerm = document.getElementById('searchBar').value.toLowerCase();
    fetch('/gameHistory')
        .then(response => response.json())
        .then(data => {
            const filteredData = data.filter(game => {
                const playerNames = `${game.White.toLowerCase()} ${game.Black.toLowerCase()}`;
                return playerNames.includes(searchTerm) || game.Date.includes(searchTerm);
            });
            displayData(filteredData);
        })
        .catch(error => console.error('Error fetching game history:', error));
});

fetch('/gameHistory')
    .then(response => response.json())
    .then(data => {
        displayData(data);
    })
    .catch(error => console.error('Error fetching game history:', error));

    function displayData(data) {
        const tableBody = document.getElementById('historyTable').querySelector('tbody');
        tableBody.innerHTML = ''; 
        data.forEach(game => {
            const serverTime = new Date(`${game.Date}T${game.Time}Z`);
    
            const localTime = new Date(serverTime.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
    
            const localTimeString = localTime.toLocaleTimeString('en-GB', { hour12: false });
    
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${game.White} - ${game.Black}</td>
                <td>${game.Result}</td>
                <td>${game.Date}</td>
                <td>${localTimeString}</td>  <!-- Display the local time -->
                <td><button class="pgn-button" data-game='${JSON.stringify(game)}'>PGN</button></td>
            `;
            tableBody.appendChild(row);
        });
    
        document.querySelectorAll('.pgn-button').forEach(button => {
            button.addEventListener('click', () => {
                const game = JSON.parse(button.getAttribute('data-game'));
                showPGN(game);
            });
        });
    }
    
    
function showPGN(game) {
    localStorage.setItem('selectedGame', JSON.stringify(game));
    window.open('historyPgn.html', '_blank');
}