- [x] Bookmark should not show toast. It should just update optimisitcally then if it fails catch the error, show the error toast and revert but never the success toast just swap the color immediately.

- [ ] Navigating between pages user is just logged out for some reason seemingly randomly, must be some gap in the auth. It definitely seems to occur navigating between pages.

- [x] Menus for the active weight configuration and the card in the weight configurations list on the settings page use the same state for the menu in the ... so if you click on the menu for one, the other opens too.

- [x] Select all misaligned mobile and tablet views, it doesn't go above the other checkboxes exactly it is to the right.

- [x] Bulk actions menu too skinny mobile. It is too narrow and hard to read the options and the options are wrapped on two lines.

- [x] Range score filters dont work. None of the ranges in the filter menu work at all. Need to fix literally all of them.

- [x] Should be able to multi select neighborhoods in the filter menu.

- [x] Done button for mobile filter menu should appear right below the 'Clear All Filters' button and stick just like that button. Should only appear for the mobile menu where it takes up the entire screen.

- [x] Categories in filters should be multi-select as well, user should be able to choose any number of categories, add search input as well like the neighborhoods section.

- [ ] Header isn't sticky mobile. I'm not sure if this is correct behavior or not on mobile. It seems like most of the time the scroll container below the header works but then sometimes the header is scrolled out of view, we need to explore how layout usually works for an app like this.

- [x] Podcast picks defaults fails to save I think when you change ALL the fields in concert. I think maybe we removed one of those fields and never update the form in the settings.

- [x] For the stats page put the score distibution at the top and the other states below it.

- [ ] Processed link queue card has bad status badge. It doesn't match the other patterns and it doesn't fit on the card we need to debug this together.

- [x] Cancelling job for permalink or for recalcuation or anywhere should not have button loading state. We do optimistic updates where the modal just closes and then toast appears. We still have modals where we wait for the API call. We need to audit all the confirmation modals and places with action buttons to make sure none are showing a loading state and making the user wait.

- [ ] Status badge on completed jobs should have right colors and it should be in the right place, need to debug this again together for the entire card.

- [x] Need mark as unused. We can never unmark as used. THings marked as used need a way to be unmarked both bulk and singleton in the feed need to make sure we update the details page card as well.

- [ ] Photo banner of ballpark. Need a banner in black and white probably behind the hero text to make it look cool.

- [ ] Queued badge in mobile needs to go below on feed card, again nothing fits here and we have to debug and fix all the cards to work better.

- [x] We have stats for categories, users should be able to click on a category card and redirect to feed with the filter set. We should make sure button/stat has hover state and cursor hover pointer.

- [ ] The header for the feed card has too much shit at the top for mobile and tablet, we have to redesign it to look better probably moving some of the badge etc below somehow.
