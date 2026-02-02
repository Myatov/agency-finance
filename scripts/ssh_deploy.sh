#!/usr/bin/expect -f

set timeout 30
set host "62.217.176.108"
set user "root"
set password "0axsBe&xtda9"

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect {
    "password:" {
        send "$password\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "# " {
        # Connected, now execute commands
        send "cd /var/www/agency-finance && git pull origin main && npm ci --production && npm run db:generate && pm2 restart agency-finance\r"
        expect "# "
        send "exit\r"
    }
    timeout {
        puts "Connection timeout"
        exit 1
    }
}

expect eof
