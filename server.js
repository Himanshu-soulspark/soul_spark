<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DarePlay - The Ultimate Challenge</title>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <!-- CSS is unchanged, so it is kept the same -->
    <style>
        :root{--primary-color:#FF4848;--secondary-color:#FF8A00;--background-color:#121212;--surface-color:#1E1E1E;--text-color:#FFFFFF;--text-secondary-color:#A9A9A9}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Poppins',sans-serif;background-color:var(--background-color);color:var(--text-color);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        .app-container{max-width:450px;margin:0 auto;background-color:var(--background-color);min-height:100vh;display:flex;flex-direction:column;position:relative;padding-bottom:70px}
        .app-header{display:flex;justify-content:space-between;align-items:center;padding:15px 20px;background-color:var(--surface-color);border-bottom:1px solid #333}
        .app-header h1{font-size:1.5em;font-weight:700;background:linear-gradient(90deg,var(--primary-color),var(--secondary-color));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .header-icons{display:flex;align-items:center}
        #header-user-name{font-weight:600;margin-right:10px}
        #header-profile-pic{width:35px;height:35px;border-radius:50%;border:2px solid var(--secondary-color);object-fit:cover}
        .content{flex-grow:1;overflow-y:auto;padding:20px}
        .page{display:none;animation:fadeIn .5s}@keyframes fadeIn{from{opacity:0}to{opacity:1}}.page.active{display:block}
        .btn{display:block;width:100%;padding:15px;border-radius:8px;border:none;font-size:1.1em;font-weight:600;cursor:pointer;text-align:center;transition:transform .2s, background .3s}.btn:active{transform:scale(.98)}
        .btn-primary{background:linear-gradient(90deg,var(--primary-color),var(--secondary-color));color:var(--text-color)}
        .btn:disabled{background:var(--text-secondary-color);cursor:not-allowed}
        #create-content{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:calc(100vh - 200px)}
        #generated-dares-form{width:100%;margin-top:20px}
        .dare-block{background-color:var(--surface-color);border:1px solid #333;border-radius:8px;padding:15px;margin-bottom:15px;text-align:left}
        .dare-block p{margin:0 0 10px 0}
        .dare-block strong{color:var(--secondary-color)}
        .dare-block input{width:100%;background-color:#121212;border:1px solid #444;border-radius:5px;padding:10px;color:var(--text-color);font-size:1em}
        .loader{border:4px solid var(--surface-color);border-top:4px solid var(--primary-color);border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px auto}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;max-width:450px;margin:0 auto;background-color:var(--surface-color);display:flex;justify-content:space-around;padding:10px 0;border-top:1px solid #333}
        .nav-item{display:flex;flex-direction:column;align-items:center;color:var(--text-secondary-color);cursor:pointer;border:none;background:none}.nav-item.active{color:var(--primary-color)}.nav-item .icon{font-size:1.6em}.nav-item .label{font-size:.7em}
        #user-info-modal{position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.9);z-index:100;display:flex;align-items:center;justify-content:center}
        .modal-content{background-color:var(--surface-color);padding:25px;border-radius:12px;width:90%;max-width:400px;text-align:center}
        .modal-content h2{margin-bottom:20px}
        .form-group{margin-bottom:15px;text-align:left}
        .form-group label{display:block;margin-bottom:5px;font-size:0.9em;color:var(--text-secondary-color)}
        .form-group input{width:100%;background-color:#121212;border:1px solid #444;border-radius:8px;padding:12px;color:var(--text-color);font-size:1em}
        .dare-post{background-color:var(--surface-color);border-radius:12px;margin-bottom:20px;overflow:hidden;border:1px solid #282828}
        .dare-post-header{display:flex;align-items:center;padding:10px 15px}
        .dare-post-header img{width:40px;height:40px;border-radius:50%;margin-right:10px;border:2px solid var(--secondary-color)}
        .dare-post-header .user-info{font-weight:600}
        .dare-post-header .user-info span{display:block;font-size:.8em;color:var(--text-secondary-color)}
        .custom-video-player{position:relative;background-color:#000;width:100%;padding-top:56.25%;overflow:hidden}
        .custom-video-player iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
        .dare-text-display{text-align:center;font-size:1.1em;font-weight:600;padding:15px;min-height:60px}
        .dare-post-actions{display:flex;justify-content:space-around;padding:15px;border-top:1px solid #282828}
        .action-button{display:flex;align-items:center;background:none;border:none;color:var(--text-secondary-color);font-size:1em;cursor:pointer}
    </style>
</head>
<body>
    <div id="user-info-modal">
         <!-- User Info Modal content remains the same -->
        <div class="modal-content">
            <h2>Welcome to DarePlay</h2>
            <p style="color: var(--text-secondary-color); margin-bottom: 20px;">Please enter your details to continue.</p>
            <form id="user-info-form">
                <div class="form-group"><label for="user-name">Name</label><input type="text" id="user-name" required></div>
                <div class="form-group"><label for="user-email">Email</label><input type="email" id="user-email" required></div>
                <div class="form-group"><label for="user-mobile">Mobile No.</label><input type="tel" id="user-mobile" required></div>
                <div class="form-group"><label for="user-address">Address</label><input type="text" id="user-address" required></div>
                <div class="form-group"><label for="user-pic">Profile Pic URL</label><input type="url" id="user-pic" placeholder="https://example.com/image.jpg" required></div>
                <button type="submit" class="btn btn-primary" style="margin-top:10px;">Submit and Enter</button>
            </form>
        </div>
    </div>

    <div class="app-container" style="display: none;">
        <!-- App Header and Nav remain the same -->
        <header class="app-header">
            <h1>DarePlay</h1>
            <div class="header-icons">
                <span id="header-user-name"></span>
                <img id="header-profile-pic" src="" alt="User">
            </div>
        </header>

        <main class="content">
            <section id="home" class="page active">
                <div id="dare-feed"><p style="text-align: center; color: var(--text-secondary-color);">Dare feed will appear here.</p></div>
            </section>
            <section id="create" class="page">
                <div id="create-content">
                    <div id="payment-container">
                        <h2>Unlock Your Dares</h2>
                        <p>Pay to generate 5 unique and challenging dares.</p>
                        <button id="pay-btn" class="btn btn-primary" style="margin-top: 20px;" onclick="startPayment()" disabled>Loading Payment...</button>
                    </div>
                    <div id="loader" class="loader" style="display: none;"></div>
                    <form id="generated-dares-form" style="display: none;"></form>
                </div>
            </section>
            <section id="leaderboard" class="page"><h2>🏆 Leaderboard</h2></section>
            <section id="profile" class="page"><h2>👤 Profile</h2></section>
        </main>

        <nav class="bottom-nav">
            <button class="nav-item active" onclick="showPage('home')"><span class="icon">🏠</span><span class="label">Home</span></button>
            <button class="nav-item" onclick="showPage('create')"><span class="icon">➕</span><span class="label">Create</span></button>
            <button class="nav-item" onclick="showPage('leaderboard')"><span class="icon">🏆</span><span class="label">Leaderboard</span></button>
            <button class="nav-item" onclick="showPage('profile')"><span class="icon">👤</span><span class="label">Profile</span></button>
        </nav>
    </div>

    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
        import { getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
        
        const firebaseConfig = {
          apiKey: "AIzaSyDuvWTMJL5edNG6cheez5pmwI2KlLCwtjw",
          authDomain: "shubhzone-4a6b0.firebaseapp.com",
          projectId: "shubhzone-4a6b0",
        };
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        let razorpayKeyId;
        let currentUser = {};

        // *** नया फ़ंक्शन: ब्राउज़र की मेमोरी (localStorage) को जाँचना ***
        function checkLocalStorageForDares() {
            const savedDares = localStorage.getItem('pendingDares');
            if (savedDares) {
                console.log("Found pending dares in memory. Displaying them.");
                displayDares(JSON.parse(savedDares));
                document.getElementById('payment-container').style.display = 'none';
            }
        }

        // --- User Info Handling ---
        document.getElementById('user-info-form').addEventListener('submit', function(e) {
            e.preventDefault();
            currentUser = {
                name: document.getElementById('user-name').value, email: document.getElementById('user-email').value,
                mobile: document.getElementById('user-mobile').value, address: document.getElementById('user-address').value,
                picUrl: document.getElementById('user-pic').value
            };
            
            document.getElementById('header-user-name').innerText = currentUser.name.split(' ')[0];
            document.getElementById('header-profile-pic').src = currentUser.picUrl;
            
            document.getElementById('user-info-modal').style.display = 'none';
            document.querySelector('.app-container').style.display = 'flex';
            
            initializePaymentService();
            loadDareFeed();
        });

        async function initializePaymentService() { /* ... unchanged ... */ }
        
        window.showPage = (pageId) => {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            const navButton = document.querySelector(`.nav-item[onclick="showPage('${pageId}')"]`);
            if (navButton) navButton.classList.add('active');

            // *** बदलाव: जब भी 'Create' पेज पर जाएँ, मेमोरी जाँचें ***
            if (pageId === 'create') {
                checkLocalStorageForDares();
            }
        };

        window.startPayment = async () => { /* ... unchanged ... */ };
        
        async function verifyPaymentAndGenerateDares(paymentResponse) {
            const loader = document.getElementById('loader');
            document.getElementById('payment-container').style.display = 'none';
            loader.style.display = 'block';
            try {
                const response = await fetch('/api/verify-payment', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(paymentResponse)
                });
                const result = await response.json();
                if (result.error) throw new Error(result.error);
                
                // *** नया: डेयर को ब्राउज़र की मेमोरी में सहेजें ***
                localStorage.setItem('pendingDares', JSON.stringify(result.dares));
                
                displayDares(result.dares);
            } catch (error) {
                alert("Error after payment: " + error.message);
                loader.style.display = 'none';
                document.getElementById('payment-container').style.display = 'block';
                document.getElementById('pay-btn').disabled = false;
            }
        }

        function displayDares(dares) { /* ... unchanged ... */ }

        document.getElementById('generated-dares-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const proofs = [];
            // ... form validation logic is the same ...

            try {
                await addDoc(collection(db, "dareSubmissions"), {
                    user: currentUser, proofs: proofs, status: "pending_verification",
                    timestamp: serverTimestamp()
                });
                alert("Proofs submitted for verification!");
                
                // *** नया: सबमिशन के बाद मेमोरी साफ़ करें ***
                localStorage.removeItem('pendingDares');

                this.innerHTML = '';
                this.style.display = 'none';
                document.getElementById('payment-container').style.display = 'block';
                initializePaymentService(); // Reset payment button text

            } catch (error) {
                alert("Failed to submit proofs. Please try again.");
            }
        });

        function loadDareFeed() { /* ... unchanged ... */ }
        function createDarePostHTML(id, post) { /* ... unchanged ... */ }
        function extractYouTubeID(url) { /* ... unchanged ... */ }

        // Initialize with home page
        showPage('home');

    </script>
</body>
</html>
