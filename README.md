# CAMPUSFLOW — College Hackathon MVP
### Simple College Service Queue & Token Management System
**WebCraft 24 | Hackathon 5.0**

A simple, lightweight, offline-ready college hackathon project built with clean frontend/backend separation.

---

## 1. Technology Stack
- **Frontend**: HTML5, Native CSS3, Vanilla JavaScript (100% Offline, Zero CDNs, Zero Frameworks)
- **Backend**: Minimal PHP (Simple procedural PDO prepared statements & session auth)
- **Database**: MySQL (3 simple tables: `users`, `services`, `tokens`)
- **Server**: Apache / XAMPP on `localhost`

---

## 2. Project Directory Structure
```text
campusflow-hackathon/
│
├── frontend/
│   │
│   ├── pages/
│   │   ├── login.html             # Clean white-card login (with 1-click quick-fill)
│   │   │
│   │   ├── student/
│   │   │   ├── dashboard.html     # Select service & view active token
│   │   │   └── token.html         # Live token tracking (People Ahead & ETA)
│   │   │
│   │   ├── staff/
│   │   │   └── dashboard.html     # View queue, Call Next, Start, Complete
│   │   │
│   │   └── admin/
│   │       └── dashboard.html     # 4 simple stats & Add/Activate/Deactivate service
│   │
│   ├── css/
│   │   └── style.css              # Simple native CSS
│   │
│   ├── js/
│   │   └── app.js                 # Single Vanilla JS file (fetch requests & DOM updates)
│   │
│   └── assets/                    # Local static assets
│
├── backend/
│   │
│   ├── config/
│   │   └── db.php                 # Simple PDO connection (host: 127.0.0.1, user: root)
│   │
│   ├── api/
│   │   ├── auth.php               # Login, logout, session check
│   │   ├── services.php           # Active services list & admin add/toggle
│   │   └── tokens.php             # Token generation, queue display & staff actions
│   │
│   └── middleware/
│       └── auth.php               # Simple session & role checking
│
├── database/
│   └── campusflow.sql             # 3 tables + pre-seeded demo accounts
│
├── index.html                     # Gateway redirect to frontend/pages/login.html
└── README.md
```

---

## 3. Demo Accounts
All passwords use native PHP `password_hash($pwd, PASSWORD_BCRYPT)`:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Student** | `student@campusflow.local` | `student123` |
| **Staff** | `staff@campusflow.local` | `staff123` |
| **Admin** | `admin@campusflow.local` | `admin123` |

*The login page includes 1-click **Demo Quick-Fill** buttons for testing during evaluation.*

---

## 4. Setup in 2 Minutes (XAMPP / Localhost)
1. Copy the folder to your XAMPP `htdocs` directory:
   `htdocs/CampusFlow/`
2. Start **Apache** and **MySQL** in XAMPP.
3. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) and import `database/campusflow.sql`.
4. Open your browser:
   `http://localhost/CampusFlow/` (or `http://localhost/CampusFlow/frontend/pages/login.html`)

---

## 5. Demonstration Flow
1. **Student Login**: Sign in as `student@campusflow.local`.
2. **Generate Token**: Under **Examination Cell**, click **Get Token** -> `EX-001` is generated.
3. **View Token**: Screen shows `EX-001`, Status: `WAITING`, `People Ahead: 0`, `ETA: 0 min`.
4. **Staff Login**: In another browser window, sign in as `staff@campusflow.local`.
5. **Call Next**: Click **Call Next Token** -> Status changes to `CALLED`.
6. **Start Processing**: Click **Start Processing** -> Status changes to `PROCESSING`.
7. **Complete**: Click **Complete Token** -> Status changes to `COMPLETED`.
8. **Student View**: Student screen automatically updates to `COMPLETED`.
9. **Admin Login**: Sign in as `admin@campusflow.local` -> view 4 stats (Total Today, Waiting, Completed, Active Services) and add/toggle services.
