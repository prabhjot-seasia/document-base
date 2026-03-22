Feature: Document Base SSO Login
  As a user of Document Base
  I want to login through the Auth Service SSO
  So that I can access the document management system with single sign-on

  Background:
    Given the auth service is running on port 8080
    And the document base backend is running on port 8082
    And the document base frontend is running on port 3001

  @sso @login @critical
  Scenario: User is redirected to auth service when not logged in
    Given I open the Document Base application
    Then I should be redirected to the auth service login page
    And the redirect URL should contain the document-base client_id
    And the redirect URL should contain a redirect_uri back to document base

  @sso @login @critical
  Scenario: Complete SSO login flow with doc_admin user
    Given I open the Document Base application
    And I am redirected to the auth service login page
    When I enter username "doc_admin" and password "Admin@123"
    And I click the login button
    Then I should be redirected back to Document Base
    And the Document Base dashboard should load
    And I should see "Document Base" in the header
    And I should see the user dropdown with username "doc_admin"

  @sso @login @permissions
  Scenario: doc_admin user sees all tabs after login
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    Then I should see the "Documents" tab
    And I should see the "Upload" tab
    And I should see the "Directories" tab
    And I should see the "Archive" tab

  @sso @login @permissions
  Scenario: doc_reader user sees only read tabs after login
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    Then I should see the "Documents" tab
    And I should see the "Archive" tab
    And I should not see the "Upload" tab
    And I should not see the "Directories" tab

  @sso @logout @critical
  Scenario: User can logout from Document Base
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I open the user dropdown menu
    And I click the logout button
    Then I should be redirected to the auth service login page

  @sso @login @redirect
  Scenario: User is returned to Document Base after auth service login
    Given I open the Document Base application
    And I am redirected to the auth service login page
    When I enter username "admin" and password "Admin@123"
    And I click the login button
    Then I should be redirected back to Document Base
    And the URL should be the Document Base root URL
    And the Document Base dashboard should load
