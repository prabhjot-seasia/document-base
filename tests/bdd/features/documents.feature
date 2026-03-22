Feature: Document Operations
  As a user of Document Base
  I want to upload, search, version, and delete documents
  So that I can manage PDF documents effectively

  Background:
    Given the auth service is running on port 8080
    And the document base backend is running on port 8082
    And the document base frontend is running on port 3001

  @documents @setup
  Scenario: Set up test data
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I clean up test document "Employee Handbook"
    And I ensure directory "HR" exists

  @documents @upload
  Scenario: Upload a new PDF document
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Upload" tab
    And I fill in document name "Employee Handbook"
    And I select directory "HR" for the document
    And I fill in tags "hr, handbook, 2024"
    And I fill in start date "2024-01-01"
    And I attach the PDF file "test-document.pdf"
    And I click the upload submit button
    Then the upload should succeed

  @documents @search
  Scenario: Search for an uploaded document by name
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    Then I should see "Employee Handbook" in the document list
    And the document should show directory "HR"
    And the document should show tags "hr, handbook, 2024"

  @documents @search
  Scenario: Search for a document by tag
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I filter documents by tag "handbook"
    Then I should see "Employee Handbook" in the document list

  @documents @view
  Scenario: View and Download buttons are visible
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    Then I should see a "View" button for "Employee Handbook"
    And I should see a "Download" button for "Employee Handbook"

  @documents @version
  Scenario: Upload a new version of an existing document
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Upload" tab
    And I fill in document name "Employee Handbook"
    And I select directory "HR" for the document
    And I fill in start date "2025-01-01"
    And I attach the PDF file "test-document-v2.pdf"
    And I click the upload submit button
    Then the upload should succeed with version 2

  @documents @version
  Scenario: View document version history
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    And I click on the document "Employee Handbook"
    Then I should see the version history table
    And I should see version "2" marked as "Current"
    And I should see version "1" marked as "Archived"

  @documents @archive
  Scenario: View archived documents
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Archive" tab
    Then I should see "Employee Handbook" in the archive list

  @documents @pinned
  Scenario: Documents are not visible on home screen by default
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    Then I should not see any document cards on the home screen
    And I should see the pinned documents section

  @documents @pinned
  Scenario: Pin a document to make it visible on home screen
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    And I click the pin button for "Employee Handbook"
    Then I should see "Employee Handbook" in the pinned section

  @documents @pinned
  Scenario: Pinned document is visible on home screen without searching
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    Then I should see "Employee Handbook" in the pinned section

  @documents @pinned
  Scenario: Read-only user cannot see pin button
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    Then I should not see the pin button for "Employee Handbook"

  @documents @pinned
  Scenario: Unpin a document removes it from home screen
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I click the unpin button for "Employee Handbook"
    Then I should not see "Employee Handbook" in the pinned section

  @documents @version @archive-view
  Scenario: Archived version View button opens the old version (not current)
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    And I click on the document "Employee Handbook"
    Then I should see the version history table
    And the View button for version "1" should link to the version-specific URL
    And the View button for version "2" should link to the document URL

  @documents @version @archive-view
  Scenario: Viewing archived version via URL shows archived badge
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    And I click on the document "Employee Handbook"
    And I open the archived version "1" in a new tab
    Then the document viewer should show an archived version badge
    And the archived version badge should contain "archived"

  @documents @version @archive-view
  Scenario: Downloading archived version gets the old file
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    And I click on the document "Employee Handbook"
    Then I should be able to download version "1"
    And I should be able to download version "2"

  @documents @delete
  Scenario: Delete a document
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "Employee Handbook"
    And I click on the document "Employee Handbook"
    And I click the "Delete Document" button
    And I confirm the deletion
    Then I should see the documents list
    When I search for document "Employee Handbook"
    Then I should not see "Employee Handbook" in the document list

  @documents @permissions
  Scenario: Read-only user cannot upload documents
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    Then I should not see the "Upload" tab

  @documents @permissions
  Scenario: Read-only user cannot see Directories tab
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    Then I should not see the "Directories" tab

  @documents @permissions
  Scenario: Read-only user can search and view documents
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    When I navigate to the "Documents" tab
    Then I should see the document search interface

  @documents @permissions
  Scenario: Read-only user cannot see delete button
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Upload" tab
    And I fill in document name "PermTest Doc"
    And I select directory "HR" for the document
    And I attach the PDF file "test-document.pdf"
    And I click the upload submit button
    Then the upload should succeed
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    When I navigate to the "Documents" tab
    And I search for document "PermTest Doc"
    And I click on the document "PermTest Doc"
    Then I should not see the delete button

  @documents @cleanup
  Scenario: Clean up test data
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I clean up test document "PermTest Doc"
    And I clean up directory tree "HR"
    And I navigate to the "Directories" tab
    Then I should not see a directory named "HR" in the tree
