Feature: Directory Management
  As a doc_admin user of Document Base
  I want to create, rename, and delete directories
  So that I can organize documents in a hierarchical structure

  Background:
    Given the auth service is running on port 8080
    And the document base backend is running on port 8082
    And the document base frontend is running on port 3001

  @directories @create
  Scenario: Create a root-level directory
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Directories" tab
    And I enter "TestDir" as the new directory name
    And I click the "Create" button in the directory form
    Then I should see a directory named "TestDir" in the tree
    And I should see a success message containing "created"

  @directories @create
  Scenario: Create a child directory under an existing parent
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Directories" tab
    And I enter "SubFolder" as the new directory name
    And I select "TestDir" as the parent directory
    And I click the "Create" button in the directory form
    Then I should see a success message containing "created"
    When I expand directory "TestDir"
    Then I should see a directory named "SubFolder" in the tree

  @directories @delete
  Scenario: Delete a child directory
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Directories" tab
    When I expand directory "TestDir"
    And I click the "Delete" button on directory "SubFolder"
    And I confirm the deletion
    Then I should see a success message containing "deleted"

  @directories @rename
  Scenario: Rename a directory
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Directories" tab
    And I click the "Rename" button on directory "TestDir"
    And I change the directory name to "RenamedDir"
    And I click the inline "Save" button
    Then I should see a directory named "RenamedDir" in the tree
    And I should see a success message containing "renamed"

  @directories @delete
  Scenario: Delete a directory
    Given I am logged into Document Base as "doc_admin" with password "Admin@123"
    When I navigate to the "Directories" tab
    And I click the "Delete" button on directory "RenamedDir"
    And I confirm the deletion
    Then I should not see a directory named "RenamedDir" in the tree
    And I should see a success message containing "deleted"

  @directories @permissions
  Scenario: Read-only user cannot see Directories tab
    Given I am logged into Document Base as "doc_reader" with password "Admin@123"
    Then I should not see the "Directories" tab
