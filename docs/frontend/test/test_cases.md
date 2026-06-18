# Login Module Test Cases

---

## TC_LOGIN_001

Verifying that  admin can login with valid credentials

### Steps

1. Open  the login page
2. Enter valid email
3. Enter valid password
4. Click login button

### Test Data

* Email: [admin@nayara.com]
* Password: password123

### Expected Result

* User will be  redirected to dashboard
* Sidebar will be  visible
* Header  will be visible
* No error message will be  shown

### Priority

High

### Status

Executed

---

## TC_LOGIN_002

Verify ing that login fails with invalid password

### Steps

1. Open the login page
2. Enter valid email
3. Enter incorrect password
4. Click login button

### Test Data

* Email: [admin@nayara.com]
* Password: WrongPassword123

### Expected Result

* Error message should bedisplayed
* User remains on the login page
* Dashboard should not be accessible

### Priority

High

### Status

 Executed

---

## TC_LOGIN_003

Verify  that login fails with invalid email

### Steps

1. Open the login page
2. Enter the  invalid email
3. Enter the valid password
4. Click on the login button

### Test Data

* Email: [wronguser@gmail.com]
* Password: password123

### Expected Result

* Login will be denied
* Error message should be displayed

### Priority

High

### Status

Executed

---

## TC_LOGIN_004

Verify that login fails when both fields are empty

### Steps

1. Open the login page
2. Leave the email empty
3. Leave the password empty
4. Click on the login button

### Expected Result

* Validation message should be shown
* Login should not be allowed

### Priority

Medium

### Status

Executed

---

## TC_LOGIN_005

Verify that email fields are  validated

### Steps

1. Open the login page
2. Enter any invalid email format
3. Enter valid  password
4. Click on login

### Test Data

* Email: invalid-email
* Password: password123

### Expected Result

* Email validation message shoud be  displayed

### Priority

Medium

### Status

Not Executed

---

## TC_LOGIN_006

Verify that password field masks the  characters

### Steps

1. Open the login page
2. Enter any password

### Expected Result

* Password should be hidden using dots 

### Priority

Low

### Status

 Executed

---

## TC_LOGIN_007

Verify  that dashboard is inaccessible without login

### Steps

1. Open the  dashboard URL directly without login

### Expected Result

* User should be  redirected to login page

### Priority

High

### Status

 Executed

---

## TC_LOGIN_008

Verify that the  session persists after page refresh

### Steps

1. Login successfully
2. Refresh  the browser

### Expected Result

* User should  remain logged in

### Priority

Medium

### Status

Executed

---

## TC_LOGIN_009

Verify  the logout functionality

### Steps

1. Login successfully
2. Click the logout button

### Expected Result

* User should beredirected to login page
* Session  should becleared

### Priority

High

### Status

Executed
