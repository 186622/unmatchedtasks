# Development To-Do List Backend

A comprehensive task management system with Discord integration for development teams.

## 🚀 Features

- **User Authentication**: JWT-based auth with role management
- **Task Management**: Create, assign, update, and track development tasks
- **Discord Integration**: Real-time notifications and DM assignments
- **Role-Based Access**: Staff, Developer, and Admin roles with different permissions
- **File Uploads**: Evidence attachment support (images/videos)
- **Statistics Dashboard**: Track productivity and task completion
- **Real-time Notifications**: Discord webhook integration

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- Discord Bot Token
- Discord Server with proper permissions

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Install dependencies
npm install
```

### 2. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Run the database setup script
source database-setup.sql
```

Or manually create the database:
```sql
CREATE DATABASE dev_todo_db;
```

### 3. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token
5. Add bot to your server with these permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands

### 4. Configuration

#### Option A: Using config.json (Recommended for development)
```bash
# Copy and edit the config file
cp config.json.example config.json
```

Edit `config.json` with your settings:
```json
{
  "database": {
    "host": "localhost",
    "user": "your_db_user",
    "password": "your_db_password",
    "name": "dev_todo_db"
  },
  "discord": {
    "botToken": "YOUR_BOT_TOKEN",
    "channelId": "YOUR_CHANNEL_ID"
  }
}
```

#### Option B: Using Environment Variables (Recommended for production)
```bash
# Copy and edit environment file
cp .env.example .env
```

### 5. Get Discord IDs

Right-click in Discord (with Developer Mode enabled):
- **Server ID**: Right-click server name → Copy Server ID
- **Channel ID**: Right-click channel → Copy Channel ID
- **User ID**: Right-click user → Copy User ID

### 6. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## 🔐 Default Login Credentials

**Admin Account:**
- Username: `admin`
- Password: `admin123`

**Developer Accounts:**
- Username: `hanssen` / Password: `dev123`
- Username: `alice` / Password: `dev123`
- Username: `bob` / Password: `dev123`

**Staff Account:**
- Username: `john` / Password: `staff123`

⚠️ **Important**: Change these passwords immediately after first login!

## 📚 API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login

### Tasks
- `GET /api/tasks` - Get all tasks (with filters)
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id/status` - Update task status
- `PUT /api/tasks/:id/assign` - Assign task to developer

### Users
- `GET /api/users` - Get all users (admin only)
- `PUT /api/users/:id/role` - Update user role (admin only)
- `GET /api/developers` - Get all developers

### Statistics
- `GET /api/statistics` - Get dashboard statistics

### Discord Integration
- `POST /api/link-discord` - Link Discord account

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | Database host | Yes |
| `DB_USER` | Database username | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name | Yes |
| `DISCORD_BOT_TOKEN` | Discord bot token | Yes |
| `DISCORD_CHANNEL_ID` | Channel for notifications | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `PORT` | Server port | No (default: 3000) |

## 🤖 Discord Bot Commands

The bot automatically handles:
- Task creation notifications
- Assignment DMs
- Status update notifications
- Completion/rejection alerts

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation and sanitization
- File upload restrictions
- CORS protection

## 📊 User Roles

| Role | Permissions |
|------|-------------|
| **None** | View only (pending approval) |
| **Staff** | Create tasks, view statistics |
| **Developer** | Staff permissions + complete/reject assigned tasks |
| **Admin** | All permissions + user management |

## 🚦 Task Status Flow

```
Pending → In Progress → Completed
    ↓
  Rejected
```

## 📁 File Structure

```
├── script.js          # Main backend server
├── config.json        # Configuration file
├── package.json       # Dependencies
├── database-setup.sql # Database initialization
├── uploads/           # File upload directory
└── README.md          # This file
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL is running
   - Verify credentials in config
   - Ensure database exists

2. **Discord Bot Not Responding**
   - Verify bot token is correct
   - Check bot permissions in server
   - Ensure bot is online

3. **File Upload Issues**
   - Check `uploads/` directory exists
   - Verify file permissions
   - Check file size limits

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

## 🔄 Updates and Maintenance

### Database Migrations

When updating the database schema:
```sql
-- Add new columns
ALTER TABLE tasks ADD COLUMN priority ENUM('low', 'medium', 'high') DEFAULT 'medium';

-- Add indexes
CREATE INDEX idx_priority ON tasks(priority);
```

### Bot Maintenance

Check bot status:
```bash
# Check if bot is online
curl http://localhost:3000/api/health
```

## 📞 Support

For issues and questions:
1. Check this README
2. Review console logs
3. Test with default credentials
4. Verify Discord bot permissions

## 🔗 Integration with Frontend

The backend provides a REST API that works with your HTML frontend. Update your frontend JavaScript to use these endpoints:

```javascript
// Example API call
const response = await fetch('/api/tasks', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
```

## 🏗️ Production Deployment

1. Use environment variables instead of config.json
2. Set up SSL/HTTPS
3. Use a process manager (PM2)
4. Set up database backups
5. Monitor server logs
6. Use a reverse proxy (nginx)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start script.js --name "dev-todo-api"

# Save PM2 configuration
pm2 save
pm2 startup
```