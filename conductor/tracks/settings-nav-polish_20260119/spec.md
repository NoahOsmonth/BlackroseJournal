# Specification: Settings Implementation & Navigation Redesign

## 1. Overview
This track focuses on implementing a fully functional Settings screen and refining the application's core navigation UI. The goal is to provide users with control over the application's appearance (Theme) and their data, while also polishing the visual design of the bottom navigation bar to match the intended "rounded" aesthetic.

## 2. Functional Requirements

### 2.1 Settings Screen
- **Theme Control:**
  - Implement a selector with three options: **Light**, **Dark**, and **System Default**.
  - "System Default" must automatically adapt to the device's OS theme settings.
  - The selection must be persisted using local storage (`AsyncStorage`) and applied immediately upon selection.
- **Data Management:**
  - **Clear Data:** A button to delete all stored journal entries. This MUST include a confirmation dialog ("Are you sure? This cannot be undone.") before execution.
  - **Export Data:** A button to export all journal data (e.g., as a JSON file or plain text) to the device's file system or clipboard.

### 2.2 Bottom Navigation Bar
- **Visual Redesign:**
  - Update the style to be **attached to the bottom** of the screen but with **rounded top-left and top-right corners** (sheet-like appearance).
  - Ensure proper spacing and "safe area" handling for modern devices (e.g., iPhone home indicator).
  - Background color and borders must adapt cleanly to the active theme (Light/Dark).

## 3. Non-Functional Requirements
- **Theme Transitions:** Theme changes should apply smoothly without requiring an app restart.
- **Performance:** Settings retrieval should be instant; navigation rendering should cause no layout shifts.
- **Accessibility:** Ensure all new settings controls and navigation tabs have appropriate accessibility labels and hit targets.

## 4. Out of Scope
- Cloud synchronization or backup.
- User account management (Login/Signup/Delete Account).
- Notification settings.
