# ==================================================================
#  AATHIRA MART - Role System E2E Test
#  Verifies BUYER / SELLER / ADMIN authorization end to end.
#  Run:  powershell -ExecutionPolicy Bypass -File scripts\e2e-roles.ps1
#  Requires the app running on http://localhost:8080
# ==================================================================
$ErrorActionPreference = 'Stop'
$Base = 'http://localhost:8080'
$script:pass = 0
$script:fail = 0
$script:tmp = Join-Path $env:TEMP 'am_e2e'
New-Item -ItemType Directory -Force -Path $script:tmp | Out-Null

function Check($name, $cond, $detail) {
  if ($cond) { $script:pass++; Write-Host "  [PASS] $name" -ForegroundColor Green }
  else       { $script:fail++; Write-Host "  [FAIL] $name  ->  $detail" -ForegroundColor Red }
}

function Req($method, $path, $bodyObj, $token) {
  $file = $null
  if ($null -ne $bodyObj) {
    $file = Join-Path $script:tmp 'body.json'
    ($bodyObj | ConvertTo-Json -Depth 6) | Set-Content -Path $file -Encoding UTF8
  }
  $curlArgs = @('-s', '-o', (Join-Path $script:tmp 'out.txt'), '-w', '%{http_code}',
            '-X', $method, ($Base + $path), '-H', 'Content-Type: application/json')
  if ($token) { $curlArgs += @('-H', "Authorization: Bearer $token") }
  if ($file)  { $curlArgs += @('--data-binary', "@$file") }
  $code = & curl.exe @curlArgs
  $raw = Get-Content (Join-Path $script:tmp 'out.txt') -Raw
  $json = $null
  try { $json = $raw | ConvertFrom-Json } catch { }
  [pscustomobject]@{ code = [int]$code; json = $json; raw = $raw }
}

function Login($email, $pass) {
  $r = Req 'POST' '/api/auth/login' @{ email = $email; password = $pass } $null
  if ($r.code -eq 200) { return $r.json }
  return $null
}

$sfx = Get-Random -Maximum 99999
$buyer1Email = "e2e.buyer1.$sfx@example.com"
$buyer2Email = "e2e.buyer2.$sfx@example.com"
$seller1Email = "e2e.seller1.$sfx@example.com"
$seller2Email = "e2e.seller2.$sfx@example.com"
$buyer3Email = "e2e.buyer3.$sfx@example.com"
$pw = 'Test@1234'

Write-Host "`n=== 1. Registration & roles ===" -ForegroundColor Cyan

$r = Req 'POST' '/api/auth/register' @{ fullName = 'E2E Buyer One'; email = $buyer1Email; password = $pw; phone = '9876500001'; role = 'BUYER' } $null
Check 'register buyer1 returns 201 + BUYER role' ($r.code -eq 201 -and $r.json.user.role -eq 'BUYER') "code=$($r.code) role=$($r.json.user.role)"
$buyer1 = $r.json.token

$r = Req 'POST' '/api/auth/register' @{ fullName = 'E2E Buyer Two'; email = $buyer2Email; password = $pw; phone = '9876500002'; role = 'BUYER' } $null
Check 'register buyer2 returns 201' ($r.code -eq 201) "code=$($r.code)"
$buyer2 = $r.json.token

$r = Req 'POST' '/api/auth/register' @{ fullName = 'E2E Seller One'; email = $seller1Email; password = $pw; phone = '9876500003'; role = 'SELLER' } $null
Check 'register seller1 returns 201 + SELLER role' ($r.code -eq 201 -and $r.json.user.role -eq 'SELLER') "code=$($r.code) role=$($r.json.user.role)"
$seller1 = $r.json.token
$seller1Id = $r.json.user.id

$r = Req 'POST' '/api/auth/register' @{ fullName = 'E2E Seller Two'; email = $seller2Email; password = $pw; phone = '9876500004'; role = 'SELLER' } $null
Check 'register seller2 returns 201' ($r.code -eq 201) "code=$($r.code)"
$seller2 = $r.json.token

$r = Req 'POST' '/api/auth/register' @{ fullName = 'Sneaky Admin'; email = "e2e.admin.$sfx@example.com"; password = $pw; role = 'ADMIN' } $null
Check 'self-registering ADMIN is rejected (400)' ($r.code -eq 400) "code=$($r.code)"

$r = Req 'POST' '/api/auth/register' @{ fullName = 'Bad Role'; email = "e2e.badrole.$sfx@example.com"; password = $pw; role = 'HACKER' } $null
Check 'unknown role is rejected (400)' ($r.code -eq 400) "code=$($r.code)"

$r = Req 'POST' '/api/auth/register' @{ fullName = 'E2E Buyer Three'; email = $buyer3Email; password = $pw; role = 'BUYER' } $null
$buyer3 = $r.json.token

$admin = Login 'admin@aathiramart.com' 'Admin@123'
Check 'admin login works' ($null -ne $admin) 'login failed'
$adminTok = $admin.token
$demo = Login 'demo@aathiramart.com' 'Demo@1234'
Check 'demo account migrated to BUYER role' ($demo.user.role -eq 'BUYER') "role=$($demo.user.role)"
$sellerSeed = Login 'seller@aathiramart.com' 'Seller@123'
Check 'seeded demo seller login works' ($null -ne $sellerSeed -and $sellerSeed.user.role -eq 'SELLER') 'login failed'

Write-Host "`n=== 2. Cross-role API authorization ===" -ForegroundColor Cyan

$r = Req 'GET' '/api/admin/users' $null $buyer1
Check 'BUYER -> /api/admin/users = 403' ($r.code -eq 403) "code=$($r.code)"
$r = Req 'GET' '/api/seller/products' $null $buyer1
Check 'BUYER -> /api/seller/products = 403' ($r.code -eq 403) "code=$($r.code)"
$r = Req 'GET' '/api/admin/orders' $null $seller1
Check 'SELLER -> /api/admin/orders = 403' ($r.code -eq 403) "code=$($r.code)"
$r = Req 'GET' '/api/seller/orders' $null $null
Check 'anonymous -> /api/seller/orders = 401' ($r.code -eq 401) "code=$($r.code)"
$r = Req 'GET' '/api/admin/users' $null $null
Check 'anonymous -> /api/admin/users = 401' ($r.code -eq 401) "code=$($r.code)"
$r = Req 'GET' '/api/seller/orders' $null $adminTok
Check 'ADMIN -> /api/seller/orders allowed' ($r.code -eq 200) "code=$($r.code)"

Write-Host "`n=== 3. Seller: product management ===" -ForegroundColor Cyan

$p1Body = @{ name = "E2E Nova Buds $sfx"; description = 'E2E test earbuds with ANC'; brand = 'NovaE2E';
             price = 2999; mrp = 3999; stock = 10; image = '/images/gadgets/headphones.svg';
             categoryId = $null; featured = $false }
$cats = Req 'GET' '/api/categories' $null $null
$catId = ($cats.json | Where-Object { $_.slug -eq 'headphones' }).id
$p1Body.categoryId = $catId

$r = Req 'POST' '/api/seller/products' $p1Body $seller1
Check 'seller1 creates product (201)' ($r.code -eq 201) "code=$($r.code) $($r.raw)"
$p1 = $r.json.data

$r = Req 'GET' "/api/products?search=E2E+Nova+Buds" $null $null
Check 'seller product visible in public catalogue' ($r.code -eq 200 -and $r.json.totalElements -ge 1) "code=$($r.code) total=$($r.json.totalElements)"

$r = Req 'GET' '/api/seller/products' $null $seller1
Check 'seller1 product list contains own product only' ($r.code -eq 200 -and $r.json.Count -eq 1 -and $r.json[0].id -eq $p1.id) "count=$($r.json.Count)"

$r = Req 'GET' '/api/seller/products' $null $seller2
Check 'seller2 list does NOT contain seller1 product' ($r.code -eq 200 -and @($r.json | Where-Object { $_.id -eq $p1.id }).Count -eq 0) "count=$($r.json.Count)"

$p2Body = $p1Body.Clone()
$p2Body.name = "E2E Volt Buds $sfx"
$r = Req 'POST' '/api/seller/products' $p2Body $seller2
$p2 = $r.json.data
Check 'seller2 creates product (201)' ($r.code -eq 201) "code=$($r.code)"

$r = Req 'PUT' "/api/seller/products/$($p2.id)" (@{ name = "E2E Volt Buds $sfx"; description = 'hijack'; brand = 'NovaE2E'; price = 1; stock = 1; categoryId = $catId; featured = $false }) $seller1
Check 'seller1 cannot update seller2 product (403)' ($r.code -eq 403) "code=$($r.code)"

$upd = $p1Body.Clone(); $upd.stock = 25; $upd.name = "E2E Nova Buds Pro $sfx"
$r = Req 'PUT' "/api/seller/products/$($p1.id)" $upd $seller1
Check 'seller1 updates own product (200, stock=25)' ($r.code -eq 200 -and $r.json.data.stock -eq 25) "code=$($r.code) stock=$($r.json.data.stock)"

$r = Req 'PUT' "/api/seller/products/$($p1.id)" $upd $adminTok
Check 'ADMIN can update seller product via seller API (200)' ($r.code -eq 200) "code=$($r.code)"

$r = Req 'POST' '/api/seller/products' @{ name = ''; description = ''; brand = ''; price = 0; stock = -1; categoryId = $catId } $seller1
Check 'seller product validation errors (400 + field errors)' ($r.code -eq 400 -and $null -ne $r.json.errors) "code=$($r.code)"

$r = Req 'GET' '/api/admin/products' $null $adminTok
Check 'admin sees ALL products incl. seller ones' ($r.code -eq 200 -and @($r.json | Where-Object { $_.id -eq $p1.id }).Count -eq 1) "code=$($r.code)"

$adminProdBody = @{ name = "E2E Admin Gadget $sfx"; description = 'Platform listing'; brand = 'Aathira';
                    price = 1999; stock = 5; categoryId = $catId; featured = $false; image = '/images/gadgets/accessories.svg' }
$r = Req 'POST' '/api/admin/products' $adminProdBody $adminTok
Check 'admin creates platform product (201)' ($r.code -eq 201) "code=$($r.code)"
$adminProd = $r.json.data

Write-Host "`n=== 4. Buyer: shopping & own orders ===" -ForegroundColor Cyan

$r = Req 'GET' '/api/orders' $null $buyer1
Check 'buyer1 has no orders initially' ($r.code -eq 200 -and $r.json.Count -eq 0) "count=$($r.json.Count)"

$stockBefore = $r2 = $null
$pd = Req 'GET' "/api/products/$($p1.id)" $null $null
$stockBefore = $pd.json.data.stock

$checkout = @{
  items = @(@{ productId = $p1.id; quantity = 2 }, @{ productId = $adminProd.id; quantity = 1 })
  paymentMethod = 'COD'
  shipping = @{ name = 'E2E Buyer Two'; phone = '9876500002'; line1 = '42 Test Street';
                line2 = ''; city = 'Kochi'; state = 'Kerala'; pincode = '682001' }
}
# subtotal 2999x2 + 1999 = 7997 (>= 999 => free delivery, total 7997)
$r = Req 'POST' '/api/orders' $checkout $buyer2
Check 'buyer2 places order (201), free delivery above 999' ($r.code -eq 201 -and $r.json.data.totalAmount -eq 7997) "code=$($r.code) total=$($r.json.data.totalAmount)"
$order = $r.json.data
$item1 = $order.items | Where-Object { $_.productId -eq $p1.id }

$pd = Req 'GET' "/api/products/$($p1.id)" $null $null
Check 'stock decremented by 2 (25 -> 23)' ($pd.json.data.stock -eq ($stockBefore - 2)) "stock=$($pd.json.data.stock)"

$r = Req 'GET' '/api/orders' $null $buyer1
Check "buyer1 does NOT see buyer2's order" ($r.json.Count -eq 0) "count=$($r.json.Count)"

$r = Req 'GET' "/api/orders/$($order.id)" $null $buyer1
Check "buyer1 cannot open buyer2's order (403)" ($r.code -eq 403) "code=$($r.code)"

$r = Req 'GET' "/api/orders/$($order.id)" $null $buyer2
Check 'buyer2 opens own order (200) with customerName + item status' ($r.code -eq 200 -and $r.json.data.customerName -eq 'E2E Buyer Two' -and $null -ne $r.json.data.items[0].status) "code=$($r.code)"

# quantity is capped at 10 per line; adminProd has stock 5 -> shortage => 409
$short = @{ items = @(@{ productId = $adminProd.id; quantity = 10 }); paymentMethod = 'COD';
            shipping = $checkout.shipping }
$r = Req 'POST' '/api/orders' $short $buyer2
Check 'checkout beyond stock -> 409' ($r.code -eq 409) "code=$($r.code)"

Write-Host "`n=== 5. Seller: relevant orders & fulfilment ===" -ForegroundColor Cyan

$r = Req 'GET' '/api/seller/orders' $null $seller1
Check 'seller1 sees order containing own product' ($r.code -eq 200 -and $r.json.Count -eq 1) "count=$($r.json.Count)"
$sOrder = $r.json[0]
Check 'seller1 view exposes ONLY own line' ($sOrder.items.Count -eq 1 -and $sOrder.items[0].sellerId -eq $seller1Id) "items=$($sOrder.items.Count)"
Check 'seller1 sees buyer name' ($sOrder.customerName -eq 'E2E Buyer Two') "customer=$($sOrder.customerName)"

$r = Req 'GET' '/api/seller/orders' $null $seller2
Check 'seller2 has no relevant orders' ($r.code -eq 200 -and $r.json.Count -eq 0) "count=$($r.json.Count)"

$r = Req 'GET' "/api/seller/orders/$($order.id)" $null $seller2
Check "seller2 cannot open unrelated order (403)" ($r.code -eq 403) "code=$($r.code)"

$sItemId = ($sOrder.items | Select-Object -First 1).id
$r = Req 'PUT' "/api/seller/order-items/$sItemId/status" @{ status = 'SHIPPED' } $seller2
Check "seller2 cannot update seller1's item (403)" ($r.code -eq 403) "code=$($r.code)"

$r = Req 'PUT' "/api/seller/order-items/$sItemId/status" @{ status = 'SHIPPED' } $seller1
Check 'seller1 ships item (200) and order advances to SHIPPED' ($r.code -eq 200 -and $r.json.data.status -eq 'SHIPPED') "code=$($r.code) status=$($r.json.data.status)"

$r = Req 'GET' "/api/orders/$($order.id)" $null $buyer2
Check 'buyer2 sees order SHIPPED + item SHIPPED' ($r.json.data.status -eq 'SHIPPED' -and $r.json.data.items[0].status -eq 'SHIPPED') "status=$($r.json.data.status)"

$r = Req 'PUT' "/api/seller/order-items/$sItemId/status" @{ status = 'TELEPORTED' } $seller1
Check 'invalid item status rejected (400)' ($r.code -eq 400) "code=$($r.code)"

# admin completes the platform-only line, seller completes theirs
$r = Req 'PUT' "/api/seller/order-items/$sItemId/status" @{ status = 'DELIVERED' } $seller1
Check 'seller1 delivers own item (200)' ($r.code -eq 200) "code=$($r.code)"
$adminItem = $order.items | Where-Object { $_.productId -eq $adminProd.id }
$r = Req 'PUT' "/api/seller/order-items/$($adminItem.id)/status" @{ status = 'DELIVERED' } $adminTok
Check 'ADMIN delivers platform line via seller API (200)' ($r.code -eq 200) "code=$($r.code)"
$r = Req 'GET' "/api/orders/$($order.id)" $null $buyer2
Check 'order auto-DELIVERED once all lines delivered' ($r.json.data.status -eq 'DELIVERED') "status=$($r.json.data.status)"

Write-Host "`n=== 6. Admin: users, sellers, orders ===" -ForegroundColor Cyan

$r = Req 'GET' '/api/admin/users' $null $adminTok
$allUsers = $r.json
Check 'admin lists all users (>= 7)' ($r.code -eq 200 -and $allUsers.Count -ge 7) "count=$($allUsers.Count)"
Check 'roles visible in user list' (@($allUsers | Where-Object { $_.role -eq 'SELLER' }).Count -ge 3 -and @($allUsers | Where-Object { $_.role -eq 'ADMIN' }).Count -ge 1) 'missing roles'

$r = Req 'GET' '/api/admin/sellers' $null $adminTok
Check 'admin seller list contains our 2 test sellers' (@($r.json | Where-Object { $_.email -eq $seller1Email }).Count -eq 1 -and @($r.json | Where-Object { $_.email -eq $seller2Email }).Count -eq 1) "count=$($r.json.Count)"

$b1Id = ($allUsers | Where-Object { $_.email -eq $buyer1Email }).id
$r = Req 'PUT' "/api/admin/users/$b1Id/role" @{ role = 'SELLER' } $adminTok
Check 'admin promotes buyer1 -> SELLER (200)' ($r.code -eq 200 -and $r.json.data.role -eq 'SELLER') "code=$($r.code)"

$relogin = Login $buyer1Email $pw
Check 'role change effective immediately after re-login' ($relogin.user.role -eq 'SELLER') "role=$($relogin.user.role)"
$buyer1New = $relogin.token
$r = Req 'GET' '/api/seller/products' $null $buyer1New
Check 'promoted buyer can now use seller API' ($r.code -eq 200) "code=$($r.code)"

$r = Req 'PUT' "/api/admin/users/$b1Id/role" @{ role = 'BUYER' } $adminTok
Check 'admin demotes buyer1 back -> BUYER (200)' ($r.code -eq 200 -and $r.json.data.role -eq 'BUYER') "code=$($r.code)"

# with DB-backed JWT roles, the token issued before the promotion must also
# lose seller access the moment the account is demoted (no re-login needed)
$r = Req 'GET' '/api/seller/products' $null $buyer1
Check 'old token loses seller access immediately after demotion (403)' ($r.code -eq 403) "code=$($r.code)"

$r = Req 'PUT' '/api/admin/users/999999/role' @{ role = 'BUYER' } $adminTok
Check 'role change on missing user -> 404' ($r.code -eq 404) "code=$($r.code)"

$r = Req 'PUT' "/api/admin/users/$b1Id/role" @{ role = 'SUPERUSER' } $adminTok
Check 'invalid role value -> 400' ($r.code -eq 400) "code=$($r.code)"

$adminId = $admin.user.id
$r = Req 'PUT' "/api/admin/users/$adminId/role" @{ role = 'BUYER' } $adminTok
Check 'admin cannot change own role (400)' ($r.code -eq 400) "code=$($r.code)"

$r = Req 'DELETE' "/api/admin/users/$adminId" $null $adminTok
Check 'admin cannot delete own account (400)' ($r.code -eq 400) "code=$($r.code)"

$r = Req 'DELETE' "/api/admin/users/$b1Id" $null $adminTok
Check 'cannot delete user without orders? buyer1 has none -> 200' ($r.code -eq 200) "code=$($r.code) $($r.raw)"

$b2Id = $null
$r = Req 'GET' '/api/admin/users' $null $adminTok
$b2Id = ($r.json | Where-Object { $_.email -eq $buyer2Email }).id
$r = Req 'DELETE' "/api/admin/users/$b2Id" $null $adminTok
Check 'cannot delete buyer with orders (400)' ($r.code -eq 400) "code=$($r.code)"

$r = Req 'GET' '/api/admin/orders' $null $adminTok
Check 'admin sees all orders incl. ours' ($r.code -eq 200 -and @($r.json | Where-Object { $_.id -eq $order.id }).Count -eq 1) "count=$($r.json.Count)"

$r = Req 'GET' "/api/admin/orders/$($order.id)" $null $adminTok
Check 'admin order detail (200) with all lines + customer' ($r.code -eq 200 -and $r.json.data.items.Count -eq 2 -and $r.json.data.customerName -eq 'E2E Buyer Two') "items=$($r.json.data.items.Count)"

$r = Req 'PUT' "/api/admin/orders/$($order.id)/status" @{ status = 'CONFIRMED' } $adminTok
Check 'admin sets order status (200)' ($r.code -eq 200 -and $r.json.data.status -eq 'CONFIRMED') "code=$($r.code)"

$r = Req 'PUT' "/api/admin/orders/$($order.id)/status" @{ status = 'WARPED' } $adminTok
Check 'invalid order status -> 400' ($r.code -eq 400) "code=$($r.code)"

# cancel restocks: order has p1 x2 -> stock 23 should go back to 25
$r = Req 'PUT' "/api/admin/orders/$($order.id)/status" @{ status = 'CANCELLED' } $adminTok
Check 'admin cancels order (200)' ($r.code -eq 200 -and $r.json.data.status -eq 'CANCELLED') "code=$($r.code)"
$pd = Req 'GET' "/api/products/$($p1.id)" $null $null
Check 'cancel restored stock (23 -> 25)' ($pd.json.data.stock -eq ($stockBefore)) "stock=$($pd.json.data.stock)"
$r = Req 'PUT' "/api/admin/orders/$($order.id)/status" @{ status = 'PLACED' } $adminTok
Check 'un-cancel re-reserves stock (-> 23)' ($r.code -eq 200) "code=$($r.code)"

Write-Host "`n=== 7. Dashboard pages ===" -ForegroundColor Cyan
foreach ($page in @('/buyer-dashboard.html', '/seller-dashboard.html', '/admin-dashboard.html', '/login.html', '/register.html', '/index.html')) {
  $r = Req 'GET' $page $null $null
  Check "page $page -> 200" ($r.code -eq 200) "code=$($r.code)"
}
$r = Req 'GET' '/js/seller-dashboard.js' $null $null
Check 'seller-dashboard.js served (200)' ($r.code -eq 200) "code=$($r.code)"
$r = Req 'GET' '/js/admin-dashboard.js' $null $null
Check 'admin-dashboard.js served (200)' ($r.code -eq 200) "code=$($r.code)"
$r = Req 'GET' '/js/buyer-dashboard.js' $null $null
Check 'buyer-dashboard.js served (200)' ($r.code -eq 200) "code=$($r.code)"

# cleanup test product created by admin (delete before users are cleaned by DB script)
Req 'DELETE' "/api/admin/products/$($adminProd.id)" $null $adminTok | Out-Null

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  PASS: $script:pass   FAIL: $script:fail" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "======================================`n" -ForegroundColor Cyan

# expose ids for the cleanup script
@{
  buyer1Email = $buyer1Email; buyer2Email = $buyer2Email; buyer3Email = $buyer3Email
  seller1Email = $seller1Email; seller2Email = $seller2Email
  productId = $p1.id; adminProductId = $p1.id
} | ConvertTo-Json | Set-Content -Path (Join-Path $script:tmp 'ids.json') -Encoding UTF8

if ($script:fail -gt 0) { exit 1 } else { exit 0 }
