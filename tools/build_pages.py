#!/usr/bin/env python3
"""SEO landing pages: one per town (areas/) and one per service (services/).

build_blog.py calls write_pages() and adds the returned URLs to sitemap.xml,
so run build_blog.py to rebuild everything (running this file does the same).
Town pages show that town's shoots from SHOOTS; service pages pull example
photos from the posts. Copy describes only what the photos show.
"""
import os, sys, html, json

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import build_blog as B

AREAS = os.path.join(HERE, "areas")
SERVICES = os.path.join(HERE, "services")
NAV = B.NAV.replace('href="index.html">Blog', 'href="../blog/index.html">Blog')
BUSINESS = {"@type": "ProfessionalService", "name": "Listing Pixl", "telephone": "+1-609-780-7027",
            "email": B.EMAIL, "url": B.DOMAIN, "image": f"{B.DOMAIN}/images/riogrande_01_twilight.jpg",
            "address": {"@type": "PostalAddress", "addressLocality": "Dennisville", "addressRegion": "NJ",
                        "postalCode": "08210", "addressCountry": "US"},
            "priceRange": "$295–$750"}
OUT_OF_COUNTY = {"Millville", "Vineland", "Buena", "Somers Point"}

# Per-town copy. "homes" and "photos" are unique write-ups; the pricing
# paragraph adds "pricing" to the shared package rundown.
TOWN_COPY = {
    "Villas": dict(
        homes="Villas sits on the Delaware Bay side of Lower Township, a grid of quiet residential streets running down to the bay beaches. Most of what we photograph here are one-story ranches, bungalows and shore cottages, many with decks, sheds, outdoor showers and detached garages, plus a steady stream of renovations and new construction. We have shot more listings in Villas than anywhere else: renovated ranches on W Wilde Ave, a new two-story build with white oak floors and a marble shower, a raised cottage with a lattice deck on E Atlantic Ave, a cottage with a beamed great room and a backyard pond a few blocks from the bay, and a blue bayfront home sitting on the dunes above the beach on Village Rd.",
        homes2="Inside, Villas homes vary more than the street view suggests. Our photos here include a coral living room with a blue sectional and a bathroom with bold blue wave tile on W New York Ave, a garage converted into a game room and bar on Rutledge Ave, butcher block counters and a farmhouse sink on Jennings Ave, a sunroom family room with coastal decor on Walnut Ave, and a renovated cottage on Alexander Ave with a quartz kitchen and a finished upstairs bonus room.",
        photos="Two things sell a Villas listing online: the yard and the bay. Buyers want to see the deck, the fire pit, the outdoor shower and how much lawn comes with the house, so we shoot the backyard as carefully as the kitchen and add a top-down drone view of the lot. Then the drone goes up and faces the water. On many Villas streets the Delaware Bay is a short walk away, and an aerial that shows the bay past the rooftops answers the first question most buyers ask. Inside, Villas cottages are often compact, so HDR matters: blended exposures keep the windows from blowing out and let a small living room read bright and open without stretching it. For a ranch with a plain daytime front, a virtual twilight edit gives the listing a cover photo that stands out in a feed of gray-sky shots, like the ones we made for 15 N 11th St, 116 W Wilde Ave and 10 E Atlantic Ave.",
        pricing="Because we are based in Dennisville, Villas is a local shoot for us.",
        faq=("Do you photograph vacation rentals in Villas?", "Yes. Our vacation rental shoot is $800 for two sessions, a lifestyle shoot and a house shoot, and works well for bay-block rentals and second homes.")),
    "Cape May": dict(
        homes="Cape May is known for its Victorian district and its beaches at the southern tip of New Jersey, but plenty of homes with a Cape May address sit outside the historic streets, in wooded neighborhoods of ranches and Cape Cods on larger lots. That is where our Cape May shoots have been: a Cape Cod with knotty pine interiors on a big tree-lined lot on Iselin Rd, a red-shingle ranch with a cast iron wood stove, raised garden beds and a barn-style shed on Blueberry Ln S, and a ranch on Thistle Ln with a white kitchen, a vaulted living room, a shaded back deck and a covered front porch with rocking chairs.",
        homes2="The interiors in these homes have character worth showing. At Iselin Rd we photographed a knotty pine living room with a big picture window, a wood-paneled kitchen and an updated bathroom with a glass shower. Blueberry Ln S had a living room with a pressed-tin style ceiling and a wood stove on a tile hearth. At Thistle Ln, the white kitchen with recessed lighting, a dining area with French doors and a Japanese maple out front each got their own frame.",
        photos="In these neighborhoods the lot is a selling point, and it is hard to show from the ground. Trees hide where the property ends, and a wide lawn just looks like grass in a phone photo. Drone aerials fix that: a top-down view shows the shape of the lot, the driveway and the outbuildings, and a wider shot over the treetops shows the quiet, wooded setting buyers come here for. Inside, wood-paneled and knotty pine rooms are tricky because they soak up light and can turn orange on camera; bracketed HDR exposures and careful color correction keep the wood warm and true while the windows stay clear. We also give the details that make a home feel like Cape May their own frames: porches, wood stoves, gardens and sheds. For second homes and rentals, our vacation rental shoot pairs a lifestyle session with the house shoot.",
        pricing="Cape May is at the far end of our home county, and every package price applies there as listed.",
        faq=("Do you photograph vacation rentals in Cape May?", "Yes. Our vacation rental shoot is $800 for two sessions: a lifestyle shoot and a house shoot.")),
    "North Cape May": dict(
        homes="North Cape May is the part of Lower Township between Cape May and the Delaware Bay, near the Cape May-Lewes Ferry terminal. Its streets are mostly one-story ranches and cottages on regular lots, many with fenced yards, back decks and sheds, and the bay beaches are close by. Our North Cape May shoots fit that picture: a gray ranch with dark shutters on a corner lot on Scott Ave with an enclosed sunroom and a detached garage, a ranch on Adriatic Ave with red shutters, a fenced yard and a red barn-style shed, and a ranch on Harmony Ln with green shutters, an updated bathroom, a back deck and a fenced brick patio.",
        homes2="Each of these homes had something buyers notice in person and deserve to see online. At Scott Ave it was the enclosed sunroom with windows on three sides and new stainless appliances in the oak kitchen. At Adriatic Ave it was the bright living room, the open dining area beside the kitchen and the large backyard behind the deck. At Harmony Ln it was the rattan pendant lights in the living room, a kids' room with white bunk beds and a brick patio with a picnic table.",
        photos="Ranches can look alike in listing photos, so the job is to show what makes each one different. Usually that is the outdoor space and the location. We shoot the back deck, the patio and the yard from angles that show their real size, then fly the drone for a top-down view of the lot and a wider aerial toward the bay, which tells buyers how close the water is without opening a map. Inside, one-story homes tend to have rooms that open into each other, like a living room that flows into the kitchen; we compose those shots to show how the rooms connect, and use HDR so the room and the view through the windows are both properly exposed. Sunrooms, kids' rooms and freshly painted spaces get their own frames because they help a family picture living there. If the front of a ranch looks flat under a midday sky, a virtual twilight edit gives the listing a stronger cover photo.",
        pricing="North Cape May is in Cape May County, so there is no travel quote to wait on.",
        faq=("Can you show how close a North Cape May home is to the bay?", "Yes. Our drone aerials face the Delaware Bay when it is in view, like the shots we took toward the bay at Scott Ave and Adriatic Ave.")),
    "Wildwood": dict(
        homes="Wildwood is the boardwalk town on Five Mile Beach, with some of the widest beaches on the Jersey Shore. Its housing runs from older shore houses with big front porches to three-story homes with stacked balconies, new construction townhomes and oceanfront condos, and many of them are second homes or rentals. We have photographed that whole range: drone aerials over the beach for a condo on Atlantic Ave, a three-story shore home on Rio Grande Ave with a backyard pool and a bunk room, a two-story home on W Pine Ave with balconies and a backyard swim spa, a three-story shore house with a wide front porch on E Garfield Ave, and new townhomes with three levels of balconies on W Bennett Ave.",
        homes2="Inside, these homes are set up for groups. At Rio Grande Ave we photographed a living room with a teal accent wall, a kitchen island with bar seating, a dining area with sliding doors to the balcony and a bunk room with a twin-over-full bunk bed. W Pine Ave had an open living room with a gas fireplace and a tiled walk-in shower. E Garfield Ave had a dining room beside a brick fireplace and a back patio with colorful chairs under a shade tree.",
        photos="Wildwood buyers often shop from out of town, and many are thinking about rental income as much as living space, which changes what the photos need to show. Balconies, porches, pools and decks get dedicated shots because they are what a renter books. Bunk rooms and extra bedrooms get photographed so the sleeping space is easy to picture. And the drone does the most important job: an aerial down the street toward the beach and ocean shows the walk to the sand in one image, like the one we flew down Rio Grande Ave. A virtual twilight is especially effective on shore homes with lots of windows and balconies, where the house glows against a dusk sky. For new construction that is still empty, virtual staging can furnish a room, like the staged bedroom at the W Bennett Ave townhomes.",
        pricing="Wildwood is in Cape May County, so the package prices apply as listed.",
        faq=("Do you photograph vacation rentals in Wildwood?", "Yes. Our vacation rental shoot is $800 for two sessions: a lifestyle shoot and a house shoot, built for listings that will also go on Airbnb or VRBO.")),
    "North Wildwood": dict(
        homes="North Wildwood takes up the north end of Five Mile Beach, with ocean blocks on one side, the back bay and marshes on the other, and the Hereford Inlet Lighthouse near the tip. Homes run from bayfront townhomes and condos to classic shore houses, and New Jersey Ave is lined with shops and businesses. Our North Wildwood work shows both sides of town: a bayfront townhome on Paradise Way with a waterfront patio, balconies facing the marsh and a primary bedroom that opens onto a bay-view deck, and a retail space on New Jersey Ave, where we photographed the sales floor and a wood-lined back room and flew aerials showing the Welcome to North Wildwood water tower and the surrounding blocks.",
        homes2="The Paradise Way townhome shows what a full waterfront shoot covers: a living room with a gas fireplace and coastal decor, a dining room with a chandelier and farmhouse table, a white kitchen with a marble island, a primary bathroom with a glass shower and double vanity, and a covered balcony with rocking chairs facing the bay. Every room with a window toward the water was shot so the view stays part of the picture, not an afterthought.",
        photos="Water views sell North Wildwood, and they are easy to undersell. A view out a sliding door turns into a white rectangle if the room is exposed for the interior alone. We bracket every shot and blend the exposures so the bay, the marsh and the sky stay visible through the glass while the room stays bright. On balconies and decks we shoot toward the water and, when the light allows, catch the sunset over the bay, like the balcony shot at Paradise Way with its Adirondack chairs. Virtual twilight edits work well on townhome rows, where every window glows against a dusk sky. For commercial listings we photograph the space the way a buyer or tenant would walk it, from the main floor to the storage and back rooms, then add drone aerials that place the building on the street among its neighbors.",
        pricing="North Wildwood is in Cape May County, so these prices apply as listed. Commercial spaces are quoted per job.",
        faq=("Do you photograph commercial properties in North Wildwood?", "Yes. We photographed the retail space at 606 New Jersey Ave, inside and from the air. Send the address and what you need, and we will quote it.")),
    "Cape May Court House": dict(
        homes="Cape May Court House is the county seat in Middle Township, set back from the barrier islands with more land and newer neighborhoods than the beach towns, and a short drive from Stone Harbor, Avalon and the Wildwoods. You will find ranches on wooded lots, homes with inground pools and townhome communities. Our shoots here include a townhome on St Andrews Dr with a two-story living room, a primary bedroom that opens onto a balcony and a covered patio facing the lawn; a ranch on Lomurno Ln with a fenced inground pool and a detached two-car garage on a big wooded lot; and a long ranch on Cedar Mill Ln with a large kitchen, a built-in office, an enclosed sunroom and a wide-open lot backed by woods and fields.",
        homes2="Inside, Court House homes tend to be roomy. At St Andrews Dr we photographed a white kitchen with a breakfast bar, a dining room with two-tone walls and a primary bathroom with a soaking tub. Lomurno Ln had a bright great room with a vaulted ceiling and an arched window, a maple kitchen with granite counters and a living room with a fireplace and wood mantel. Cedar Mill Ln had a family room with big windows and a primary bedroom with a sitting area.",
        photos="Space is the story in Court House, so drone aerials are the core of the shoot. A top-down view shows the house, the pool and the garage at a glance, and a wider aerial over the woods and fields shows the privacy buyers move inland for. On the ground, pools and patios get several angles, including the view from the back door, so buyers see how the outdoor space connects to the house. Townhome communities need a different approach: one unit can look like the next, so we focus on what stands out inside, such as tall windows, fireplaces and balconies, and use an aerial to show the community around it. Big great rooms with vaulted ceilings are where HDR earns its keep, holding detail in tall windows while the room stays evenly lit. The St Andrews Dr listing also got virtual twilight exteriors, with the townhome row glowing at dusk.",
        pricing="Court House is in the middle of our home county, so the package prices apply as listed.",
        faq=("Can you add virtual staging to a Cape May Court House listing?", "Yes. Virtual staging is $35 per photo and decluttering is $25 per photo, on top of any package or on their own.")),
    "Ocean View": dict(
        homes="Ocean View is part of Dennis Township, the wooded stretch of the county just inland from Sea Isle City and a short drive from Ocean City. It is also home turf for us: Listing Pixl is based in Dennisville, in the same township. Homes here are mostly ranches and colonials on bigger lots than you find at the shore, many with decks, pools and large backyards edged by trees. Our Ocean View shoots include a brick-front ranch on White Oak Dr with a fireplace, a family room with French doors, a back deck with a gazebo and a big lawn, and a two-story colonial on Williams Way with a butcher block kitchen island, a multi-level deck, an above-ground pool, a pergola and fire pit area and a backyard play set.",
        homes2="The interiors had plenty to show as well. At White Oak Dr we photographed a gray-cabinet kitchen with a granite island, a family room with teal walls and a wood accent wall, and a dining room with a farmhouse table on hardwood floors. At Williams Way the family room has a built-in entertainment wall, the bathroom has a wood vanity with black fixtures, and the backyard has a pergola, fire pit and grill area alongside the deck and pool.",
        photos="Ocean View buyers are usually choosing a yard over a beach block, so the backyard has to be in the photos. We shoot decks, pools and play areas as their own scenes, then fly the drone for a top-down view of the full lot and a wide aerial over the neighborhood that shows how the trees frame it. Homes with a lot of rooms benefit from a clear sequence, exterior to living spaces to kitchen, bedrooms, baths and then the yard, so a buyer can walk the house in their head while scrolling. Virtual twilight edits suit two-story colonials with symmetrical fronts and plenty of windows; at Williams Way we delivered two, including a straight-on front exterior at dusk. Inside, hardwood floors and big windows look their best with blended HDR exposures that keep the wood tones natural and the view outside visible.",
        pricing="Ocean View is minutes from our Dennisville base, inside Cape May County.",
        faq=("Where is Listing Pixl based?", "In Dennisville, Dennis Township, the same township as Ocean View. We shoot across Cape May County and quote South Jersey towns outside the county case by case.")),
    "Millville": dict(
        homes="Millville is in Cumberland County along the Maurice River, with Union Lake on the north side of town. Buyers get more house and more land for the money than at the shore, and the homes are varied: mid-century modern houses on wooded lots, Cape Cods, older homes in town and newer neighborhoods. Our two Millville shoots show that range. 601 Dove Dr is a mid-century modern home on a wooded lot near the lake, with a great room with a fireplace and tall windows, a sunroom with walls of windows facing the woods and a two-story foyer. 108 W Harrison Ave is a Cape Cod with an inground pool, a back deck, a two-story living room with a loft balcony, a sunroom with a slate floor and a knotty pine kitchen.",
        homes2="Both homes had rooms that needed more than one angle to explain. At Dove Dr the open kitchen and dining area has sliding doors to the deck, the primary bathroom has a double vanity and a glass shower, and the back of the house opens onto a deck and lawn. At W Harrison Ave the family room is wood-paneled with sliding doors to the yard, an upstairs bedroom has skylights and a sloped ceiling, and the back deck holds an outdoor dining table beside the pool.",
        photos="Rooms with lots of glass, like sunrooms and great rooms with tall windows, are the hardest rooms to photograph well. Expose for the room and the windows go white; expose for the windows and the room goes dark. Our HDR process blends several exposures so you see both the room and the trees outside. Two-story spaces like a living room with a loft balcony get shot from the angle that shows their height instead of cropping it off. Drone aerials show what a ground shot cannot: at Dove Dr, the view over the treetops toward the lake, and at W Harrison Ave, a top-down shot of the house and pool together. Mid-century and architectural homes are a natural fit for a virtual twilight, where interior light glowing through the glass makes the design read at a glance; Dove Dr's cover photo is one.",
        pricing="",
        faq=("Can you add a virtual twilight to a Millville listing?", "Yes. Showcase ($475) and Premiere ($750) each include two virtual twilight edits, like the twilight exterior we delivered for 601 Dove Dr.")),
    "Vineland": dict(
        homes="Vineland, in Cumberland County, covers more ground than any other city in New Jersey, and its neighborhoods reflect that: colonials and ranches on generous lots, with room for driveways, garages and fenced yards. Our Vineland shoot on Pixwhey Ct is a good example of what buyers look for here: a two-story colonial with a two-car garage and a wraparound porch, a two-story living room with an arched window, a dining room with big windows, a finished basement family room, a primary bedroom with a vaulted ceiling and a paver patio leading to a large fenced backyard.",
        homes2="Each space in the Pixwhey Ct home got its own frame. The dining room with a chandelier and big windows sits next to the oak kitchen with its pantry. The finished basement family room has recessed lighting, which helps a basement photograph as warm living space rather than storage. Upstairs, the primary bedroom has a vaulted ceiling and the primary bathroom has a double vanity and a corner tub. Out front, the covered porch with Adirondack chairs gave the listing a welcoming second exterior shot.",
        photos="Family buyers in Vineland look closely at space: how many rooms, how big the yard, whether there is a finished basement. Good photos answer those questions in order. We shoot the exterior from angles that show the porch and garage together, cover every main living space, and give finished basements extra light so they look as inviting as the main floor. The backyard gets photographed from the patio so buyers see the fence line and the lawn. Then the drone takes three views: the house, driveway and yard together; a top-down of the whole lot; and a wide aerial of the neighborhood. A two-story living room with an arched window makes a great photo only if the window does not blow out, and HDR blending keeps the arch and the view through it intact. Oak kitchens and pantries get careful color correction so the wood looks the way it does in person.",
        pricing="",
        faq=("Can you add virtual staging to a Vineland listing?", "Yes. Virtual staging is $35 per photo and decluttering is $25 per photo, on top of any package or on their own.")),
    "Buena": dict(
        homes="Buena is a small borough in Atlantic County, surrounded by the farmland and woods of Buena Vista Township, between Vineland and Hammonton. Homes sit on roomy lots, and outdoor space such as decks, yards, garages and gardens is a big part of why people buy here. Our Buena shoot on Catherine Ave is typical of the area: a two-story home with a two-car garage, a living room with a dark accent wall, a kitchen with sage green cabinets, a dining room with a farmhouse table, a bedroom with big windows, and out back a deck overlooking a large yard with picnic tables and a pergola.",
        homes2="The Catherine Ave shoot covered ten photos, and each answered a different question a buyer might have. The front exterior shows the two-car garage. The aerial shows the home in its yard, and the top-down shows the full lot. Inside, the living room with recliners, the kitchen with stainless appliances and the farmhouse dining table show the main floor, while the bedroom with a ceiling fan and the bathroom with a wood vanity cover the private rooms. The deck and the pergola show where summers happen.",
        photos="When the backyard is the selling point, it needs more than one photo. At Catherine Ave we shot the back deck, the picnic area and the pergola from the ground, then flew the drone for an aerial of the home and yard and a top-down view that shows the whole lot at once. That top-down shot is the one buyers zoom into, because it shows where the yard ends and how much room there is. Inside, color matters. Painted cabinets and accent walls only help a listing if they look the way they do in person, so we color-correct every frame instead of letting a filter shift the greens and grays. Bedrooms with big windows and bathrooms with patterned wallpaper get balanced HDR exposures so they look bright without washing out. If an empty room needs help, virtual staging furnishes it for $35 a photo.",
        pricing="",
        faq=("Do you include drone photos on Buena shoots?", "Yes. Every package includes 10-15 drone photos, and on large lots we always include a top-down view of the whole property.")),
    "Somers Point": dict(
        homes="Somers Point sits on Great Egg Harbor Bay in Atlantic County, just across the bridge from Ocean City. It mixes waterfront neighborhoods along the bay with classic suburban streets of two-story homes, capes and ranches. Our Somers Point shoot on Euclid Ave was an exterior and aerial job: a two-story home with a garage and lawn, photographed from the front and from the air so the listing had a strong cover photo and a clear view of the property.",
        homes2="An exterior-and-aerial set is also a good first step for agents who want something live while the house is still being prepared. The front exterior can lead the listing on day one, the aerial shows the property from above, and the interiors can follow once the rooms are ready. When we come back for the inside, the edits are matched to the first set so the gallery looks like a single shoot. Exterior-only and partial shoots are quoted per job.",
        photos="Not every listing needs a full interior shoot on day one. Sometimes an agent needs a strong exterior and aerial set quickly, for a coming-soon post or a listing where the location is the main story, and a drone shot plus a clean front exterior does that. For a full Somers Point listing we add HDR interiors: kitchens, living spaces, bedrooms and baths, shot with blended exposures so rooms look bright and the windows hold their view. Near the bay, the drone is the best tool we have, because an aerial can show how close a home sits to the bay in a single frame, where a ground photo only shows the street. A virtual twilight edit turns a daytime front exterior into a dusk cover photo that stands out in search results. Tell us what the listing needs and we will put together the right set.",
        pricing="",
        faq=("Can you shoot only exteriors and aerials in Somers Point?", "Yes. Our Euclid Ave shoot was an exterior and drone job. Tell us what you need and we will quote it with travel.")),
}

def price_para(town):
    t = html.escape(town)
    if town in OUT_OF_COUNTY:
        lead = (f"{t} is outside Cape May County, so we quote travel case by case: send the address and we will "
                f"get back to you with a price. Our packages start at $295.")
    else:
        lead = f"Packages start at $295. {html.escape(TOWN_COPY[town]['pricing'])}"
    return (f"{lead} Essential ($295) is 40&ndash;50 HDR photos, 30&ndash;35 ground and 10&ndash;15 drone, "
            f"professionally edited, sized for the MLS and delivered the next day. Showcase ($475) adds a 60-second "
            f"exterior drone video, two virtual twilight edits and a 2D floor plan. Premiere ($750) adds a 1&ndash;2 "
            f"minute cinematic walkthrough and a Matterport 3D tour with three months of hosting. Virtual staging is "
            f"$35 a photo and decluttering is $25 a photo.")

def town_faq(town):
    t = town
    if town in OUT_OF_COUNTY:
        cost = (f"Packages start at $295 for Essential, $475 for Showcase and $750 for Premiere. {t} is outside "
                f"Cape May County, so we add a travel quote for each address. Send the address and we will reply with a price.")
    else:
        cost = (f"Packages start at $295 for Essential (40-50 HDR photos including drone), $475 for Showcase and "
                f"$750 for Premiere. {t} is in Cape May County, so those prices apply with no travel quote.")
    return [
        (f"How much does a real estate photographer cost in {t}, NJ?", cost),
        (f"How fast will I get my {t} listing photos?",
         "Essential is delivered the next day. Showcase takes 2 days and Premiere 3 days, because they include video editing. Everything arrives edited and MLS-ready through your private client site."),
        (f"Do your {t} shoots include drone photos?",
         "Yes. Every package includes 10-15 drone photos. Showcase adds a 60-second exterior drone video, and a 360° drone panorama is a $95 add-on."),
        TOWN_COPY[town]["faq"],
    ]

def head(title, desc, path, image, schemas, og_type="website"):
    ld = "\n".join(f'  <script type="application/ld+json">\n  {json.dumps(s, indent=2, ensure_ascii=False)}\n  </script>' for s in schemas)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>document.documentElement.classList.add('js')</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta property="og:type" content="{og_type}">
  <link rel="canonical" href="{B.DOMAIN}{path}">
  <meta property="og:url" content="{B.DOMAIN}{path}">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:image" content="{B.DOMAIN}/images/{image}">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="stylesheet" href="../styles.css">
{ld}
{B.PIXEL_SNIPPET}
{B.GA_SNIPPET}
</head>
<body>
{NAV}
"""

def faq_html(faqs):
    items = "\n".join(f"""          <details class="faq-item">
            <summary>{html.escape(q)}</summary>
            <p>{html.escape(a)}</p>
          </details>""" for q, a in faqs)
    return f'        <div class="faq">\n{items}\n        </div>'

def faq_schema(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}

def crumbs(name, path):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{B.DOMAIN}/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": f"{B.DOMAIN}{path}"}]}

def shoot_cards(shoots):
    return "\n".join(f"""          <article class="blog-card">
            <a href="../blog/{s['slug']}.html">
              <img src="../images/{s['photos'][0][0]}"{B.srcset(s['photos'][0][0], sizes="(max-width: 720px) 100vw, 360px")} alt="{html.escape(s['photos'][0][1])}" loading="lazy"{B.img_size(s['photos'][0][0])}>
              <h3>{html.escape(s['address'])}</h3>
            </a>
            <p>{html.escape(s['blurb'] or s.get('intro', '')[:120])}</p>
            <p class="blog-meta">{html.escape(s['date'])} &middot; {len(s['photos'])} photos</p>
          </article>""" for s in shoots)

def town_page(town):
    c = TOWN_COPY[town]
    slug = B.area_slug(town)
    path = f"/areas/{slug}.html"
    shoots = [s for s in B.SHOOTS if s["town"] == town]
    hero_p, hero_a = shoots[0]["photos"][0]
    t = html.escape(town)
    title = f"Real Estate Photographer in {town}, NJ | Listing Pixl"
    desc = (f"Real estate photographer in {town}, NJ: HDR listing photos, drone aerials and virtual twilights. "
            f"See {len(shoots)} {town} shoot{'s' if len(shoots) != 1 else ''}. Packages from $295.")
    if len(desc) > 158:
        desc = desc[:155].rsplit(" ", 1)[0] + "..."
    faqs = town_faq(town)
    business = dict(BUSINESS, **{"@context": "https://schema.org", "@id": f"{B.DOMAIN}/#business",
                                 "description": f"Real estate photography in {town}, NJ: HDR photos, drone aerials, virtual twilights, floor plans and 3D tours.",
                                 "areaServed": {"@type": "City", "name": f"{town}, NJ"}})
    words = len(" ".join([c["homes"], c["homes2"], c["photos"], html.unescape(price_para(town))]).split())
    if not 400 <= words <= 600:
        print(f"build_pages.py: {town} write-up is {words} words (aim for 400-600)")
    nearby = [n for n in B.TOWNS.get(town, ("", []))[1] if n in B.AREA_TOWNS]
    nearby += [n for n in B.AREA_TOWNS if n != town and n not in nearby][:max(0, 5 - len(nearby))]
    nearby_links = "\n".join(f'          <li><a href="{B.area_slug(n)}.html">{html.escape(n)}, NJ</a></li>' for n in nearby)
    service_links = "\n".join(f'          <li><a href="../services/{sp["slug"]}.html">{html.escape(sp["name"])}</a></li>' for sp in SERVICE_PAGES)
    return head(title, desc, path, hero_p, [business, faq_schema(faqs), crumbs(f"{town}, NJ", path)]) + f"""
  <main>
    <article class="section">
      <div class="wrap narrow">
        <p class="blog-crumb"><a href="../index.html#areas">&larr; Areas we serve</a></p>
        <h1>Real Estate Photographer in {t}, NJ</h1>
        <p class="landing-lede">HDR listing photos, drone aerials and virtual twilights for {t} listings, edited and delivered MLS-ready. {len(shoots)} {t} shoot{'s' if len(shoots) != 1 else ''} and counting.</p>
        <figure class="landing-hero">
          <img src="../images/{hero_p}"{B.srcset(hero_p)} alt="{html.escape(hero_a)}" loading="eager" fetchpriority="high"{B.img_size(hero_p)}>
        </figure>

        <h2>Homes in {t}</h2>
        <p>{html.escape(c['homes'])}</p>
        <p>{html.escape(c['homes2'])}</p>

        <h2>What photos sell {a_an_town(town)} listing</h2>
        <p>{html.escape(c['photos'])}</p>

        <h2>{t} real estate photography packages</h2>
        <p>{price_para(town)}</p>
        <p class="post-cta"><a class="btn btn-pink" href="../index.html#contact">Lock In Your Shoot</a> <a class="btn btn-outline" href="tel:+16097807027">Call or text {B.PHONE}</a></p>
      </div>
    </article>

    <section class="section section-alt" aria-labelledby="shoots-heading">
      <div class="wrap">
        <h2 id="shoots-heading">Our {t} shoots</h2>
        <p class="section-lede">Every {t} listing we have photographed. Click through for the full photo set.</p>
        <div class="blog-grid landing-grid">
{shoot_cards(shoots)}
        </div>
      </div>
    </section>

    <article class="section">
      <div class="wrap narrow">
        <h2>Questions agents ask about {t} shoots</h2>
{faq_html(faqs)}

        <h2>Services</h2>
        <ul class="link-pills">
{service_links}
        </ul>

        <h2>Nearby areas we serve</h2>
        <ul class="link-pills">
{nearby_links}
        </ul>

        <h2>Book {a_an_town(town)} photographer</h2>
        <p>Pick a package and a day, and we will text you to confirm the shoot time. Call or text <a href="tel:+16097807027">{B.PHONE}</a> or email <a href="mailto:{B.EMAIL}">{B.EMAIL}</a>.</p>
        <p class="post-cta"><a class="btn btn-pink" href="../index.html#contact">Lock In Your Shoot</a> <a class="btn btn-outline" href="../blog/index.html">See all shoots</a></p>
      </div>
    </article>
  </main>

{B.FOOTER}
</body>
</html>
"""

def a_an_town(town):
    return f"{B.a_an(town)} {html.escape(town)}"

# ---------- Service pages ----------
# examples: (post slug, photo file) pairs from SHOOTS.
SERVICE_PAGES = [
    dict(slug="drone-real-estate-photography", name="Drone Photography",
         h1="Drone Real Estate Photography in Cape May County, NJ",
         title="Drone Real Estate Photography in Cape May County, NJ | Listing Pixl",
         desc="Drone aerial photos and video for South Jersey listings: top-down lot views, aerials toward the bay and beach. Included in every package from $295.",
         body=[
             ("Why listings need aerials", "A ground photo shows a house. A drone photo shows the property: where the lot ends, how big the yard is, what sits behind the house and what is around it. In Cape May County that last part often matters most. Buyers want to know how far the beach or the bay is, whether the lot backs up to woods, and what the street looks like. An aerial answers all of that in one image."),
             ("What we fly on every shoot", "Every package includes 10&ndash;15 drone photos, and we plan them as a set rather than a few random angles. A front view from above shows the house, driveway and yard together. A top-down view shows the whole lot, the roofline and the outbuildings, which is the shot buyers zoom into. A wide aerial shows the neighborhood, and when there is water in reach we point the camera at it: toward the Delaware Bay from Villas and North Cape May, down the street toward the beach in Wildwood, over the treetops toward the lake in Millville. Showcase adds a 60-second exterior drone video, and Premiere adds a 1&ndash;2 minute cinematic walkthrough."),
             ("Edited like the rest of the shoot", "Aerials go through the same editing as the interiors: color correction, straightened horizons and skies that match the ground shots, so the drone photos sit naturally in the MLS gallery."),
         ],
         examples=[("125-e-atlantic-ave-villas-nj", "125-e-atlantic-ave-villas-nj-drone-aerial.jpg"),
                   ("514-village-rd-villas-nj", "514-village-rd-villas-nj-from-the-water.jpg"),
                   ("26-lomurno-ln-cape-may-court-house-nj", "26-lomurno-ln-cape-may-court-house-nj-top-down-drone.jpg"),
                   ("218-rio-grande-ave-wildwood-nj", "218-rio-grande-ave-wildwood-nj-aerial-ocean.jpg"),
                   ("601-dove-dr-millville-nj", "dovedr_04_aerial_lake.jpg"),
                   ("101-rutledge-ave-villas-nj", "101-rutledge-ave-villas-nj-drone-sunset.jpg")],
         prices=[("Essential: 40&ndash;50 HDR photos including 10&ndash;15 drone photos", "$295"),
                 ("Showcase: adds a 60-second exterior drone video", "$475"),
                 ("Premiere: adds a 1&ndash;2 minute cinematic walkthrough video", "$750"),
                 ("360&deg; drone panorama, add-on to any shoot", "$95")]),
    dict(slug="virtual-twilight-photos", name="Virtual Twilight",
         h1="Virtual Twilight Real Estate Photos in South Jersey",
         title="Virtual Twilight Real Estate Photos in NJ | Listing Pixl",
         desc="Virtual twilight edits turn a daytime exterior into a glowing dusk cover photo. Two are included with Showcase ($475) and Premiere ($750).",
         body=[
             ("What a virtual twilight is", "A virtual twilight starts with a daytime exterior photo. In editing we replace the sky with a dusk sky, warm up the light, and make the windows glow as if the lights are on inside. The result looks like a photo taken at sunset, without scheduling a second trip to the property for a narrow window of evening light."),
             ("Why it works as a cover photo", "Most listing photos are taken in the middle of the day, so a search page is a grid of houses under similar skies. A twilight exterior stands out in that grid. It also helps homes whose daytime fronts look plain: a ranch with a flat midday sky, a townhome row, a new build without landscaping yet. Twilight flatters architecture with a lot of glass, like the mid-century modern home we shot on Dove Dr in Millville, and shore homes with stacked balconies, like the Rio Grande Ave house in Wildwood. We can also apply it to a drone photo for a twilight aerial of the street."),
             ("How we choose the shot", "We pick the exterior angle that shows the house best, usually the straight-on or slight-angle front view, and edit it as a twilight while keeping the daytime version for the gallery. Showcase and Premiere include two twilight edits, so you can use one as the cover and one later in the gallery or on social media."),
         ],
         og_image="riogrande_01_twilight.jpg",
         examples_lede="The same photo by day and as a virtual twilight. Drag the slider to compare.",
         examples=[
             dict(kind="compare", before="601-dove-dr-millville-nj-daytime-exterior.jpg", after="601-dove-dr-millville-nj-virtual-twilight-exterior.jpg",
                  before_alt="Daytime exterior of a modern home in Millville NJ", after_alt="The same home as a virtual twilight",
                  caption="Mid-century modern home with a wall of glass", labels=("Day", "Twilight"), slug="601-dove-dr-millville-nj"),
             dict(kind="compare", before="116-w-wilde-ave-villas-nj-daytime-front.jpg", after="116-w-wilde-ave-villas-nj-twilight-front.jpg",
                  before_alt="Daytime front of a new build in Villas NJ", after_alt="The same new build as a virtual twilight",
                  caption="New construction with a two-story porch", labels=("Day", "Twilight"), slug="116-w-wilde-ave-villas-nj"),
             dict(kind="compare", before="10-williams-way-ocean-view-nj-daytime-front.jpg", after="10-williams-way-ocean-view-nj-twilight-front.jpg",
                  before_alt="Daytime front of a colonial in Ocean View NJ", after_alt="The same colonial as a virtual twilight",
                  caption="Colonial with a long front lawn", labels=("Day", "Twilight"), slug="10-williams-way-ocean-view-nj"),
             dict(kind="compare", before="124-w-new-york-ave-villas-nj-daytime-front.jpg", after="124-w-new-york-ave-villas-nj-twilight-front.jpg",
                  before_alt="Daytime front of a blue cottage in Villas NJ", after_alt="The same cottage as a virtual twilight",
                  caption="Cottage with a stone-path front garden", labels=("Day", "Twilight"), slug="124-w-new-york-ave-villas-nj"),
             dict(kind="compare", before="15-n-11th-st-villas-nj-daytime-front.jpg", after="15-n-11th-st-villas-nj-twilight-front.jpg",
                  before_alt="Daytime front of a green ranch in Villas NJ in winter", after_alt="The same ranch as a virtual twilight",
                  caption="A winter ranch shot that needed warmth", labels=("Day", "Twilight"), slug="15-n-11th-st-villas-nj"),
         ],
         prices=[("Showcase: two virtual twilight edits, drone video and a 2D floor plan", "$475"),
                 ("Premiere: two virtual twilight edits plus video and a 3D tour", "$750"),
                 ("Adding twilight edits to Essential", "Ask us")]),
    dict(slug="virtual-staging", name="Virtual Staging",
         h1="Virtual Staging for Real Estate Listings in NJ",
         title="Virtual Staging for NJ Real Estate Listings | Listing Pixl",
         desc="Virtual staging furnishes empty rooms in your listing photos for $35 per photo. Virtual decluttering is $25 per photo. Add to any package.",
         body=[
             ("Why empty rooms need help", "Empty rooms photograph smaller than they are. Without furniture there is nothing to give a sense of scale, and buyers have a hard time telling a living room from a bedroom or picturing where a bed would go. Physical staging solves that but costs time and money. Virtual staging adds furniture in editing, so the room in the photo shows how it can be used."),
             ("What we stage", "We stage the rooms that matter most to buyers: the main living area, the primary bedroom, and any room whose use is not obvious when it is empty. On new construction like the 116 W Wilde Ave build in Villas and the W Bennett Ave townhomes in Wildwood, we photographed the empty rooms and staged a living room and a bedroom with furniture, rugs and decor that suit the house. Staged photos are a design aid, so we recommend noting virtual staging in the listing description."),
             ("Virtual decluttering", "If a room is furnished but busy, decluttering removes clutter and old furniture from the photo instead of adding new pieces. It is a good fit for estate sales, tenant-occupied homes and rooms that are mid-move."),
         ],
         og_image="116-w-wilde-ave-villas-nj-staged-living-area.jpg",
         examples_lede="The same room empty and virtually staged. Drag the slider to compare.",
         examples=[
             dict(kind="compare", before="116-w-wilde-ave-villas-nj-empty-living-area.jpg", after="116-w-wilde-ave-villas-nj-staged-living-area.jpg",
                  before_alt="Empty living area of a new build in Villas NJ", after_alt="The same living area virtually staged",
                  caption="Open living area with sofa, chairs and rug", labels=("Empty", "Staged"), slug="116-w-wilde-ave-villas-nj"),
             dict(kind="compare", before="116-w-wilde-ave-villas-nj-empty-back-room.jpg", after="116-w-wilde-ave-villas-nj-staged-back-living-room.jpg",
                  before_alt="Empty back room of a new build in Villas NJ", after_alt="The back room virtually staged as a living room",
                  caption="One empty room staged as a living room", labels=("Empty", "Living room"), slug="116-w-wilde-ave-villas-nj"),
             dict(kind="compare", before="116-w-wilde-ave-villas-nj-empty-back-room-b.jpg", after="116-w-wilde-ave-villas-nj-staged-back-dining-room.jpg",
                  before_alt="Empty back room of a new build in Villas NJ", after_alt="The same back room virtually staged as a dining room",
                  caption="...and the same room staged as a dining room", labels=("Empty", "Dining room"), slug="116-w-wilde-ave-villas-nj"),
             dict(kind="compare", before="116-w-wilde-ave-villas-nj-empty-front-room.jpg", after="116-w-wilde-ave-villas-nj-staged-dining-room.jpg",
                  before_alt="Empty front room of a new build in Villas NJ", after_alt="The same front room virtually staged as a dining room",
                  caption="Front room staged as a dining room", labels=("Empty", "Staged"), slug="116-w-wilde-ave-villas-nj"),
             dict(kind="compare", before="207-w-bennett-ave-wildwood-nj-empty-living-room.jpg", after="207-w-bennett-ave-wildwood-nj-staged-living-room.jpg",
                  before_alt="Empty living room of a new townhome in Wildwood NJ", after_alt="The same living room virtually staged",
                  caption="Townhome living room with sofa and bar stools", labels=("Empty", "Staged"), slug="207-w-bennett-ave-wildwood-nj"),
             dict(kind="compare", before="207-w-bennett-ave-wildwood-nj-empty-bedroom.jpg", after="207-w-bennett-ave-wildwood-nj-staged-bedroom.jpg",
                  before_alt="Empty bedroom of a new townhome in Wildwood NJ", after_alt="The same bedroom virtually staged",
                  caption="Bedroom with bed, rug and nightstands", labels=("Empty", "Staged"), slug="207-w-bennett-ave-wildwood-nj"),
             dict(kind="compare", before="116-w-wilde-ave-villas-nj-front-with-sign.jpg", after="116-w-wilde-ave-villas-nj-front-cleaned-up.jpg",
                  before_alt="New build with a yard sign out front in Villas NJ", after_alt="The same photo with the sign digitally removed",
                  caption="Clean-up: a yard sign removed from the front photo", labels=("Before", "Cleaned up"), slug="116-w-wilde-ave-villas-nj"),
         ],
         prices=[("Virtual staging: empty rooms digitally furnished", "$35 / photo"),
                 ("Virtual decluttering: clutter and old furniture removed", "$25 / photo")]),
    dict(slug="floor-plans-3d-tours", name="3D Matterport Tours",
         h1="3D Matterport Tours in Cape May County, NJ",
         title="3D Matterport Virtual Tours in NJ | Listing Pixl",
         desc="Matterport 3D virtual tours for South Jersey listings, included with the Premiere package ($750) with three months of hosting.",
         body=[
             ("What a 3D tour is", "A Matterport 3D tour is an interactive walkthrough of the home. Buyers move room to room on their phone or computer, look around at their own pace, and switch to a dollhouse view that shows the whole floor at once. It works well for second-home and relocation buyers, which is a lot of buyers at the shore, because they can walk the house before they ever book a trip."),
             ("How we make it", "We scan the home room by room with a Matterport camera. The same scan produces a measured floor plan, so a 3D tour and a 2D plan come out of one visit. The plan below came straight from one of our Matterport scans."),
             ("Hosting", "Premiere includes three months of hosting, which covers most listings from going live to closing. Tours are archived when hosting ends, so the tours from our earlier listings are no longer online; ask us and we will set up a demo."),
         ],
         og_image="17-fawn-ln-sicklerville-nj-floor-plan.jpg",
         examples_lede="A floor plan made from one of our Matterport scans.",
         examples=[
             dict(kind="image", img="17-fawn-ln-sicklerville-nj-floor-plan.jpg", plan=True, wide=True,
                  caption="Two-floor plan generated from a Matterport scan", where="17 Fawn Ln, Sicklerville"),
         ],
         prices=[("Premiere: Matterport 3D tour with 3 months hosting, plus everything in Showcase", "$750"),
                 ("3D tour on its own", "Ask us")]),
    dict(slug="hdr-real-estate-photography", name="HDR Listing Photography",
         h1="HDR Real Estate Photography in Cape May County, NJ",
         title="HDR Real Estate Photography in Cape May County, NJ | Listing Pixl",
         desc="Bright, true-color HDR listing photos for South Jersey agents: 40-50 photos including drone, edited and delivered next day. From $295.",
         body=[
             ("What HDR means for a listing", "A camera cannot see a bright window and a shaded room at the same time the way your eyes can. Shoot for the room and the windows go white; shoot for the windows and the room goes dark. HDR (high dynamic range) photography solves that by taking several exposures of each angle and blending them, so the room is bright, the colors are true and the view out the window is still there."),
             ("How we shoot a house", "We work through the home in the order a buyer would walk it: exterior, main living spaces, kitchen, bedrooms, baths, then the outdoor spaces. Each room gets the angle that shows its size and how it connects to the next room, with verticals kept straight so walls do not lean. Kitchens get a wide shot and a detail shot; decks, patios and pools get photographed as their own scenes. Every package includes drone photos, so the yard and setting are covered too."),
             ("Edited and delivered next day", "Every photo is professionally edited and color-corrected, so painted cabinets, wood floors and accent walls look the way they do in person. Essential photos are delivered the next day, sized for the MLS, through your private client site."),
         ],
         examples=[("125-e-atlantic-ave-villas-nj", "125-e-atlantic-ave-villas-nj-great-room.jpg"),
                   ("601-dove-dr-millville-nj", "601-dove-dr-millville-nj-sunroom.jpg"),
                   ("414-paradise-way-north-wildwood-nj", "414-paradise-way-north-wildwood-nj-kitchen.jpg"),
                   ("205-st-andrews-dr-cape-may-court-house-nj", "205-st-andrews-dr-cape-may-court-house-nj-living-room.jpg"),
                   ("1140-pixwhey-ct-vineland-nj", "1140-pixwhey-ct-vineland-nj-living-room.jpg"),
                   ("10-williams-way-ocean-view-nj", "10-williams-way-ocean-view-nj-kitchen.jpg")],
         prices=[("Essential: 40&ndash;50 HDR photos (30&ndash;35 ground + 10&ndash;15 drone), next-day delivery", "$295"),
                 ("Showcase: adds drone video, two virtual twilights and a 2D floor plan", "$475"),
                 ("Premiere: adds a cinematic walkthrough and a Matterport 3D tour", "$750")]),
    dict(slug="2d-floor-plans", name="2D Floor Plans",
         h1="2D Floor Plans for Real Estate Listings in Cape May County, NJ",
         title="2D Floor Plans for NJ Real Estate Listings | Listing Pixl",
         desc="Measured 2D floor plans with labeled rooms and dimensions for South Jersey listings. Included with the Showcase package ($475).",
         body=[
             ("Why buyers want a floor plan", "Photos show what rooms look like; a floor plan shows how they fit together. Buyers use it to check whether the bedrooms are on the same floor, how the kitchen connects to the living space, and whether their furniture will fit. At the shore, where many homes are stacked over three floors with a garage underneath, the plan answers the first question every buyer has: what is on which level."),
             ("What you get", "A measured, top-down drawing of every floor with each room labeled and its dimensions noted, plus the total area. Multi-level homes get a plan per floor and one sheet showing all floors side by side, like the three-story townhome on Paradise Way below. We deliver plans in black and white or in color, sized to sit in the MLS gallery next to the photos."),
             ("Homes and commercial spaces", "Plans are just as useful for commercial listings: a retail floor, a store room and a bathroom, or an office suite laid out room by room. Tenants and buyers see the usable space before they visit."),
         ],
         og_image="414-paradise-way-north-wildwood-nj-floor-plan-all-floors.jpg",
         examples_lede="Floor plans we have delivered. Click a plan to see it full size.",
         examples=[
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-floor-plan-all-floors.jpg", plan=True, wide=True,
                  caption="All three floors of a bayside townhome on one sheet", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="501-n-wildwood-blvd-cape-may-court-house-nj-floor-plan.jpg", plan=True,
                  caption="Color plan with room names and sizes", where="501 N Wildwood Blvd, Cape May Court House"),
             dict(kind="image", img="17-fawn-ln-sicklerville-nj-floor-plan.jpg", plan=True,
                  caption="Two-floor home on one sheet", where="17 Fawn Ln, Sicklerville"),
             dict(kind="image", img="606-new-jersey-ave-north-wildwood-nj-floor-plan.jpg", plan=True,
                  caption="Retail space with store room and bath", slug="606-new-jersey-ave-north-wildwood-nj"),
             dict(kind="image", img="1200-georgia-ave-cape-may-court-house-nj-floor-plan.jpg", plan=True, wide=True,
                  caption="Office suite, lower level, room by room", where="1200 Georgia Ave, Cape May Court House"),
         ],
         prices=[("Showcase: 2D floor plan, drone video and two virtual twilights", "$475"),
                 ("Premiere: floor plan plus a Matterport 3D tour", "$750"),
                 ("Floor plan on its own", "Ask us")]),
    dict(slug="property-video", name="Property Video",
         h1="Real Estate Video and Drone Films in Cape May County, NJ",
         title="Real Estate Video & Drone Films in NJ | Listing Pixl",
         desc="Drone films and walkthrough videos for South Jersey listings: a 60-second drone video with Showcase ($475), a 1-2 minute walkthrough with Premiere ($750).",
         body=[
             ("Why video", "Video is what buyers stop for on Facebook, Instagram and Zillow. A short film from the air shows what a photo gallery can only hint at: the drive up the street, how close the water is, what the neighborhood feels like at golden hour."),
             ("What we film", "Showcase includes a 60-second exterior drone video: the home, the lot and the setting, edited and ready for social and the MLS. Premiere adds a 1&ndash;2 minute cinematic walkthrough that moves through the home as well. We fly at the right time of day for the location, so the light flatters the home and the setting."),
             ("Delivered ready to post", "Films come edited, color-graded and sized for the MLS video link, Facebook and Instagram, through the same client site as your photos."),
         ],
         og_image="1622-jennings-ave-villas-nj-drone-front.jpg",
         examples_lede="Films from our shoots. Press play.",
         examples=[
             dict(kind="embed", src="https://iframe.videodelivery.net/b4ce3ae7c4e1b36ed27abaa9f4eb9c80?autoplay=true", poster="video/1622-jennings-ave-villas-nj-drone-poster.jpg",
                  caption="Drone flight over a Villas bungalow and its street", slug="1622-jennings-ave-villas-nj"),
             dict(kind="embed", src="https://iframe.videodelivery.net/bbb55ce5e67fdb6112c60c2302718f5f?autoplay=true", poster="video/320-oakdale-ave-villas-nj-drone-poster.jpg",
                  caption="Drone flight over Villas toward the bay", slug="320-oakdale-ave-villas-nj"),
         ],
         prices=[("Showcase: 60-second exterior drone video, plus twilights and a floor plan", "$475"),
                 ("Premiere: 1&ndash;2 minute cinematic walkthrough and a 3D tour", "$750"),
                 ("Video on its own", "Ask us")]),
    dict(slug="360-drone-panoramas", name="360&deg; Drone Panoramas",
         h1="360&deg; Drone Panoramas in Cape May County, NJ",
         title="360 Degree Drone Panoramas for NJ Listings | Listing Pixl",
         desc="Interactive 360-degree drone panoramas buyers can spin around: the beach, the bay and the neighborhood from above. $95, add-on to any shoot.",
         body=[
             ("What a 360 panorama is", "We fly the drone above the property and capture a full sphere of photos, then stitch them into one interactive panorama. Buyers drag to look in any direction: down at the lot, out to the beach, across to the bay or down the street. It answers the questions a single aerial cannot, all in one link."),
             ("Where it helps most", "Anywhere the location sells the home. In North Cape May and Villas it shows how close the Delaware Bay beach is; in Wildwood and North Wildwood it shows the ocean, the bay and the boardwalk; on bigger lots in Cape May and Cape May Court House it shows the land and the woods around it. Try the panoramas below: press one, then drag."),
             ("How you share it", "Each panorama has its own link and embed code for the MLS virtual tour field, your listing page and social posts. It works on phones, computers and VR headsets."),
         ],
         og_image="228-spruce-ave-delaware-bay-360-drone-panorama.jpg",
         examples_lede="Live panoramas from our shoots. Press one, then drag to look around.",
         examples=[
             dict(kind="embed", src="https://kuula.co/share/collection/7K8xp?logo=0&info=0&fs=1&vr=1&autorotate=0.2&thumbs=1&autop=8", poster="228-spruce-ave-delaware-bay-360-drone-panorama.jpg",
                  caption="Above the Delaware Bay beach", where="228 Spruce Ave, North Cape May", play="360&deg;"),
             dict(kind="embed", src="https://kuula.co/share/collection/7DnJs?logo=0&info=0&fs=1&vr=1&autorotate=0.2&thumbs=1", poster="320-oakdale-ave-villas-nj-aerial-bay.jpg",
                  caption="Villas neighborhood toward the bay", slug="320-oakdale-ave-villas-nj", play="360&deg;"),
             dict(kind="embed", src="https://kuula.co/share/collection/7DqCq?logo=0&info=0&fs=1&vr=1&autorotate=0.2&thumbs=1", poster="606-new-jersey-ave-north-wildwood-nj-street-aerial.jpg",
                  caption="North Wildwood between the ocean and the bay", slug="606-new-jersey-ave-north-wildwood-nj", play="360&deg;"),
             dict(kind="embed", src="https://kuula.co/share/collection/7HwBn?logo=0&info=0&fs=1&vr=1&autorotate=0.2&thumbs=1", poster="116-w-wilde-ave-villas-nj-drone-aerial.jpg",
                  caption="New build in Villas with the bay behind", slug="116-w-wilde-ave-villas-nj", play="360&deg;"),
             dict(kind="embed", src="https://kuula.co/share/collection/7DcFl?logo=0&info=0&fs=1&vr=1&autorotate=0.2&thumbs=1", poster="26-lomurno-ln-cape-may-court-house-nj-top-down-drone.jpg",
                  caption="Wooded lot in Cape May Court House", slug="26-lomurno-ln-cape-may-court-house-nj", play="360&deg;"),
         ],
         prices=[("360&deg; drone panorama, add-on to any shoot", "$95")]),
    dict(slug="vacation-rental-photography", name="Vacation Rental Photography",
         h1="Vacation Rental Photography for Airbnb and VRBO in Cape May County, NJ",
         title="Vacation Rental Photography for Airbnb & VRBO, NJ | Listing Pixl",
         desc="Two-session vacation rental shoots: the house plus a styled lifestyle session with the details guests book for. $800 in Cape May County.",
         body=[
             ("A listing guests can picture themselves in", "A rental listing competes on a phone screen against every other place in town for the same week. Clean room photos tell a guest the house is nice; lifestyle photos tell them what their stay will feel like. That is what earns the click, the wish-list save and the booking, and it is why our rental shoot has two sessions."),
             ("Session one: the house", "Every room, the views and the outdoor spaces, shot and edited like a listing: bright, true to color and in the order a guest walks through. Bedrooms and bunk rooms are shot so guests can count the beds, and drone aerials show how close the beach or the bay is, marked with an arrow when it helps."),
             ("Session two: the lifestyle shoot", "Then we style and shoot the details that make your place yours. Wine or prosecco and two glasses on the balcony at sunset. The guest book with your rental's name and logo. The decor you chose, down to the cutting board and the throw pillows. Rolled towels and toiletries on the bed. The bikes, kayak and beach gear waiting in the garage. These are the photos that end up as the cover of your Airbnb and VRBO listing and in your own social posts, and they give your rental a brand guests remember and book again."),
             ("Shot for The Bay Stay", "The photos below are from The Bay Stay, a bayside townhome rental on Paradise Way in North Wildwood: the guest book with its logo, prosecco at sunset over the bay, the New Jersey cutting board, the bunk room and the garage full of beach gear."),
         ],
         og_image="414-paradise-way-north-wildwood-nj-prosecco-balcony.jpg",
         examples_lede="From our lifestyle and house sessions at The Bay Stay in North Wildwood.",
         examples=[
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-prosecco-balcony.jpg", caption="Prosecco and two glasses on the balcony at sunset", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-guest-book.jpg", caption="The guest book with the rental's own logo", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-sunset-chairs.jpg", caption="Adirondack chairs facing the sunset over the bay", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-nj-cutting-board.jpg", caption="Decor details: the New Jersey cutting board", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-towels.jpg", caption="Rolled towels and toiletries ready for guests", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-beach-gear.jpg", caption="Bikes, kayak and beach gear in the garage", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-bunk-room.jpg", caption="Bunk room for the kids", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-wine-bar.jpg", caption="Stocked wine and bar shelves", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-arrow-bay.jpg", caption="Aerial with an arrow marking the rental on the bay", slug="414-paradise-way-north-wildwood-nj"),
         ],
         prices=[("Vacation rental shoot: house session plus lifestyle session", "$800"),
                 ("360&deg; drone panorama, add-on", "$95")]),
    dict(slug="neighborhood-highlights", name="Neighborhood Highlights",
         h1="Neighborhood Highlight Photos and Video in Cape May County, NJ",
         title="Neighborhood Highlight Aerials & Video in NJ | Listing Pixl",
         desc="Sell the town, not just the house: aerials with the route to the beach drawn in, local landmarks, lot lines and neighborhood films for South Jersey listings.",
         body=[
             ("Why location needs its own photos", "At the shore, location is often the reason a buyer calls. Is it walking distance to the beach? Can you see the bay? What is the town like? A gallery of rooms cannot answer that, and buyers from out of the area cannot drive by. Neighborhood highlights put the answer right in the listing."),
             ("Distance to the beach, drawn in", "We fly the drone high enough to show the home and the water together, then mark the house and draw the route to the beach or the bay in red. Buyers see in one glance that it is three blocks to the sand, without reading a word. Slide the examples below to see the route appear."),
             ("Landmarks and the lot", "We also photograph what the town is known for, like the Welcome to North Wildwood water tower, so the listing feels local. And for land and larger lots, we outline the property line from above so buyers can see exactly what is included. Drawn-in routes and lot lines are approximate, so we deliver them alongside the regular gallery, not in place of it."),
             ("Neighborhood films", "For listings and agents who want to sell the area too, we cut a short film flying over the neighborhood: the streets, the parks, the water. Agents use them on social media and on their own websites to market a town, not just one house."),
         ],
         og_image="228-spruce-ave-north-cape-may-nj-beach-route.jpg",
         examples_lede="From our shoots in North Cape May, North Wildwood and Villas. Drag the sliders to reveal the routes.",
         examples=[
             dict(kind="compare", before="228-spruce-ave-north-cape-may-nj-beach-plain.jpg", after="228-spruce-ave-north-cape-may-nj-beach-route.jpg",
                  before_alt="Aerial of a North Cape May street near the beach", after_alt="The walk to the beach drawn in red",
                  caption="A short walk to the Delaware Bay beach", labels=("Aerial", "Route"), where="228 Spruce Ave, North Cape May"),
             dict(kind="compare", before="222-oakdale-ave-north-cape-may-nj-bay-plain.jpg", after="222-oakdale-ave-north-cape-may-nj-bay-route.jpg",
                  before_alt="Aerial up Oakdale Ave toward the bay", after_alt="The route to the bay drawn in red",
                  caption="Straight up the street to the bay", labels=("Aerial", "Route"), where="222 Oakdale Ave, North Cape May"),
             dict(kind="compare", before="602-eldridge-ave-north-cape-may-nj-beach-plain.jpg", after="602-eldridge-ave-north-cape-may-nj-beach-route.jpg",
                  before_alt="Aerial of a North Cape May neighborhood", after_alt="The route to the beach drawn in red",
                  caption="Around the corner and down to the beach", labels=("Aerial", "Route"), where="602 Eldridge Ave, North Cape May"),
             dict(kind="compare", before="228-spruce-ave-north-cape-may-nj-top-down-plain.jpg", after="228-spruce-ave-north-cape-may-nj-top-down-route.jpg",
                  before_alt="Top-down aerial of a street ending at the beach", after_alt="The path to the beach drawn in",
                  caption="From straight above: the street ends at the sand", labels=("Aerial", "Route"), where="228 Spruce Ave, North Cape May"),
             dict(kind="image", img="606-new-jersey-ave-north-wildwood-nj-water-tower.jpg", caption="The Welcome to North Wildwood water tower over the town", slug="606-new-jersey-ave-north-wildwood-nj"),
             dict(kind="image", img="414-paradise-way-north-wildwood-nj-arrow-marsh.jpg", caption="An arrow marks the home between the marsh and the bay", slug="414-paradise-way-north-wildwood-nj"),
             dict(kind="compare", before="124-w-new-york-ave-villas-nj-lot-plain.jpg", after="124-w-new-york-ave-villas-nj-lot-line.jpg",
                  before_alt="Top-down drone view of a lot in Villas NJ", after_alt="The same lot with its property line outlined",
                  caption="The lot outlined from above", labels=("Aerial", "Lot line"), slug="124-w-new-york-ave-villas-nj"),
             dict(kind="embed", src="https://iframe.videodelivery.net/e94b1d91d5c82bb07a12ab5885d972e4?autoplay=true", poster="video/north-cape-may-nj-neighborhood-poster.jpg",
                  caption="Neighborhood film over North Cape May", where="North Cape May"),
         ],
         prices=[("Neighborhood aerials with routes, landmarks or lot lines", "Ask us"),
                 ("Neighborhood highlight film", "Ask us")]),
]

def _img(fname, alt, cls="", sizes="(max-width: 720px) 100vw, 560px", lazy=True):
    c = f' class="{cls}"' if cls else ""
    if "/" in fname:  # e.g. a video poster in video/
        return f'<img{c} src="../{fname}" alt="{html.escape(alt)}" loading="lazy" decoding="async">'
    return (f'<img{c} src="../images/{fname}"{B.srcset(fname, sizes=sizes)} alt="{html.escape(alt)}"'
            f'{" loading=\"lazy\"" if lazy else ""} decoding="async"{B.img_size(fname)}>')

def _where(ex):
    """Caption tail: link to the blog post when the shoot has one, else just the place."""
    if ex.get("slug"):
        s = {x["slug"]: x for x in B.SHOOTS}[ex["slug"]]
        return f' &middot; <a href="../blog/{ex["slug"]}.html">{html.escape(s["address"])}, {html.escape(s["town"])}</a>'
    return f' &middot; {html.escape(ex["where"])}' if ex.get("where") else ""

def example_figures(examples):
    """Each example shows the deliverable itself. Kinds:
    (post slug, photo)                       a photo from a blog post
    dict(kind="compare", before, after, ...) before/after slider (same frame)
    dict(kind="image", img, caption, ...)    any image, e.g. a floor plan (plan=True: show it whole)
    dict(kind="embed", src, poster, ...)     a 360 tour or film, loaded when clicked"""
    by_slug = {s["slug"]: s for s in B.SHOOTS}
    figs = []
    for i, ex in enumerate(examples):
        if isinstance(ex, tuple):
            slug, photo = ex
            s = by_slug[slug]
            alt = dict(s["photos"])[photo]  # KeyError here means the photo left the post
            figs.append(f"""          <figure>
            <a href="../blog/{slug}.html"><img src="../images/{photo}"{B.srcset(photo, sizes="(max-width: 720px) 100vw, 360px")} alt="{html.escape(alt)}" loading="lazy"{B.img_size(photo)}></a>
            <figcaption>{html.escape(alt)} &middot; <a href="../blog/{slug}.html">{html.escape(s['address'])}, {html.escape(s['town'])}</a></figcaption>
          </figure>""")
        elif ex["kind"] == "compare":
            l, r = ex.get("labels", ("Before", "After"))
            figs.append(f"""          <figure{' class="ex-wide"' if ex.get("wide", i == 0) else ""}>
            <div class="svc-media svc-compare ex-frame">{_img(ex["before"], ex["before_alt"])}{_img(ex["after"], ex["after_alt"], "svc-after")}<span class="svc-divider" aria-hidden="true"></span><span class="svc-label svc-label-l">{html.escape(l)}</span><span class="svc-label svc-label-r">{html.escape(r)}</span><input class="svc-range" type="range" min="0" max="100" value="50" aria-label="Slide to compare {html.escape(l.lower())} and {html.escape(r.lower())}"></div>
            <figcaption>{html.escape(ex["caption"])}{_where(ex)}</figcaption>
          </figure>""")
        elif ex["kind"] == "image":
            cls = "ex-plan" if ex.get("plan") else ""
            figs.append(f"""          <figure class="{'ex-wide ' if ex.get('wide') else ''}{cls}">
            <a href="../images/{ex['img']}">{_img(ex["img"], ex["caption"])}</a>
            <figcaption>{html.escape(ex["caption"])}{_where(ex)}</figcaption>
          </figure>""")
        elif ex["kind"] == "embed":
            figs.append(f"""          <figure class="ex-wide">
            <button class="ex-embed" type="button" data-src="{html.escape(ex['src'])}" aria-label="Play: {html.escape(ex['caption'])}">{_img(ex["poster"], "")}<span class="ex-play" aria-hidden="true">{ex.get("play", "&#9654;")}</span></button>
            <figcaption>{html.escape(ex["caption"])}{_where(ex)}</figcaption>
          </figure>""")
    return "\n".join(figs)

def service_page(sp):
    path = f"/services/{sp['slug']}.html"
    body = "\n".join(f"        <h2>{html.escape(h)}</h2>\n        <p>{p}</p>" for h, p in sp["body"])
    others = "\n".join(f'          <li><a href="{o["slug"]}.html">{html.escape(o["name"])}</a></li>' for o in SERVICE_PAGES if o is not sp)
    towns = "\n".join(f'          <li><a href="../areas/{B.area_slug(t)}.html">{html.escape(t)}</a></li>' for t in B.AREA_TOWNS)
    schema = {"@context": "https://schema.org", "@type": "Service", "name": sp["name"],
              "serviceType": sp["name"], "description": sp["desc"], "url": f"{B.DOMAIN}{path}",
              "provider": dict(BUSINESS, **{"@id": f"{B.DOMAIN}/#business"}),
              "areaServed": [{"@type": "City", "name": f"{t}, NJ"} for t in B.AREA_TOWNS]}
    return head(sp["title"], sp["desc"], path, sp.get("og_image") or sp["examples"][0][1], [schema, crumbs(sp["name"], path)]) + f"""
  <main>
    <article class="section">
      <div class="wrap narrow">
        <p class="blog-crumb"><a href="../index.html#services">&larr; All services</a></p>
        <h1>{html.escape(sp['h1'])}</h1>
{body}
      </div>
    </article>

    <section class="section section-alt" aria-labelledby="examples-heading">
      <div class="wrap">
        <h2 id="examples-heading">From our shoots</h2>
        <p class="section-lede">{sp.get("examples_lede", "Real listings we have photographed. Click a photo for the full shoot.")}</p>
        <div class="photo-grid">
{example_figures(sp['examples'])}
        </div>
      </div>
    </section>

    <article class="section">
      <div class="wrap narrow">
        <h2>Book this for your listing</h2>
        <p>Tell us about the property and we will text you to confirm. <a href="../index.html#packages">See our packages</a>.</p>
        <p class="post-cta"><a class="btn btn-pink" href="../index.html#contact">Lock In Your Shoot</a> <a class="btn btn-outline" href="tel:+16097807027">Call or text {B.PHONE}</a></p>

        <h2>Other services</h2>
        <ul class="link-pills">
{others}
        </ul>

        <h2>Areas we serve</h2>
        <ul class="link-pills">
{towns}
        </ul>
      </div>
    </article>
  </main>

{B.FOOTER}
</body>
</html>
"""

def write_pages():
    """Write areas/*.html and services/*.html; return their site paths for the sitemap."""
    os.makedirs(AREAS, exist_ok=True)
    os.makedirs(SERVICES, exist_ok=True)
    missing = [t for t in B.AREA_TOWNS if t not in TOWN_COPY or not any(s["town"] == t for s in B.SHOOTS)]
    if missing:
        raise SystemExit(f"build_pages.py: no copy or no shoots for {missing}")
    urls = []
    for town in B.AREA_TOWNS:
        slug = B.area_slug(town)
        open(os.path.join(AREAS, slug + ".html"), "w", encoding="utf-8").write(town_page(town))
        urls.append(f"/areas/{slug}.html")
    for sp in SERVICE_PAGES:
        open(os.path.join(SERVICES, sp["slug"] + ".html"), "w", encoding="utf-8").write(service_page(sp))
        urls.append(f"/services/{sp['slug']}.html")
    return urls

if __name__ == "__main__":
    B.main()
