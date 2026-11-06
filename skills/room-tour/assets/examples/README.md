# The four example pages

Each folder has the page's code (`index.html`, `style.css`, `tour.json`, its own `.js` layers, its drawings and
tracks) and its `walk.json`: every picture prompt and move, with notes on what went wrong and how it was fixed. The
frames and pictures aren't here, because they are too heavy; see the pages live:

| Example | Business | The walk | You click | Ends on | Live |
|---|---|---|---|---|---|
| `tembusu` | an architecture studio selling a house before it's built | entry court → living room → pool deck, soft tropical daylight | material tags → spec cards; a legend of materials grows as you pass them | a green drawing sheet: the plan, rooms and sizes, "Start a project" | [demo](https://demos.skillsmart.io/room-tour/tembusu/) |
| `teluk-senja` | a resort of twelve villas on a bay (made up) | entrance → lobby, a designed cut, villa → terrace over the sea, at dusk | + dots → short facts; the price line → a facts card | a frosted booking card over the terrace | [demo](https://demos.skillsmart.io/room-tour/teluk-senja/) |
| `ondo` | a furniture brand | a slow loop round one 70s room: the room → the reading corner → the sofa | product dots → cards with sizes, colours and add to cart; a colour picker re-colours the sofa in the room | "shop the room": every piece, the total, add all to cart | [demo](https://demos.skillsmart.io/room-tour/ondo/) |
| `shedlight` | a gallery's solo show | two warehouse rooms under skylight, through the doorway into the top-lit hall | the exact works on the walls → they lift to fill the screen; wall labels; a sculpture | visit details and the opening night | [demo](https://demos.skillsmart.io/room-tour/shedlight/) |

Teluk Senja is built in honest mode (`references/walks.md` §4): its four "photographs" first, then only moves between
photos that can see each other. Shedlight's works are laid onto blank canvases by the page (`references/gallery.md`).

The demos' pictures were made with GPT Image 2.5 and nano-banana edits; Tembusu's and Teluk Senja's moves with MiniMax
H3 Max Turbo, ondo's and Shedlight's with Kling v3 Pro. This skill's tools use nano-banana-pro and kling-v3-pro through
Skillsmart credits; the prompts and the notes carry over.
