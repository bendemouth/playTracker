document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();  // Prevent default form submission behavior
        
        let usernameEntered = document.getElementById('username').value;
        let passwordEntered = document.getElementById('password').value;

        try {
            const response = await fetch('http://bendemouthwdv101.us.tempcloudsite.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: usernameEntered, password: passwordEntered })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                window.location.href = 'homepage.html';
            } else {
                alert('Incorrect username or password. Please try again.');
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('An error occurred. Please contact account admin for help.');
        }
    });
});
