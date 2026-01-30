#!/bin/bash

# Скрипт для проверки основных API endpoints
# Требует запущенного dev сервера и авторизованной сессии

BASE_URL="http://localhost:3000"
SESSION_COOKIE=""

echo "🧪 Тестирование API endpoints..."
echo ""

# Функция для проверки endpoint
check_endpoint() {
    local method=$1
    local path=$2
    local name=$3
    
    if [ -z "$SESSION_COOKIE" ]; then
        echo "⚠️  Пропуск $name - нет сессии"
        return
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "Cookie: $SESSION_COOKIE" "$BASE_URL$path")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Cookie: $SESSION_COOKIE" -H "Content-Type: application/json" "$BASE_URL$path")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "✅ $name - OK ($http_code)"
    elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        echo "⚠️  $name - Unauthorized/Forbidden ($http_code)"
    else
        echo "❌ $name - Failed ($http_code)"
        echo "   Response: $(echo "$body" | head -c 100)"
    fi
}

echo "📋 Проверка основных endpoints:"
echo ""

# Проверка endpoints (требует авторизации)
check_endpoint "GET" "/api/auth/me" "Auth: Get current user"
check_endpoint "GET" "/api/clients" "Clients: List"
check_endpoint "GET" "/api/sites" "Sites: List"
check_endpoint "GET" "/api/services" "Services: List"
check_endpoint "GET" "/api/incomes" "Incomes: List"
check_endpoint "GET" "/api/expenses" "Expenses: List"
check_endpoint "GET" "/api/employees" "Employees: List"
check_endpoint "GET" "/api/products" "Products: List"
check_endpoint "GET" "/api/roles" "Roles: List"
check_endpoint "GET" "/api/legal-entities" "Legal Entities: List"
check_endpoint "GET" "/api/reports/incomes?dateFrom=2025-12-22&dateTo=2026-01-21" "Reports: Incomes"
check_endpoint "GET" "/api/reports/expenses?dateFrom=2025-12-22&dateTo=2026-01-21" "Reports: Expenses"
check_endpoint "GET" "/api/reports/employees?dateFrom=2025-12-22&dateTo=2026-01-21" "Reports: Employees"

echo ""
echo "📝 Примечание: Для полного тестирования необходимо:"
echo "   1. Авторизоваться через браузер"
echo "   2. Скопировать session cookie"
echo "   3. Установить SESSION_COOKIE в скрипте"
echo ""
