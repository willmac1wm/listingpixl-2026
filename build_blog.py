#!/usr/bin/env python3
"""Generate the Listing Pixl blog: SEO shoot posts, blog index, homepage slider.

Run from anywhere: output goes to blog/ next to this script.
"""
import os, re, html, json, csv

HERE = os.path.dirname(os.path.abspath(__file__))
BLOG = os.path.join(HERE, "blog")
IMAGES = os.path.join(HERE, "images")
os.makedirs(BLOG, exist_ok=True)

PHONE = "(609) 780-7027"
DOMAIN = "https://www.listingpixl.com"
PIXEL_ID = "1900535534248768"
PIXEL_SNIPPET = """  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1900535534248768');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1900535534248768&ev=PageView&noscript=1"
  /></noscript>
  <!-- End Meta Pixel Code -->
"""

GA_ID = "G-5EWNW94QHH"
GA_SNIPPET = """  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-5EWNW94QHH"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-5EWNW94QHH');
  </script>
"""

EMAIL = "ListingPixl.Media@gmail.com"
FB = "https://www.facebook.com/listing.pixl.media/"

# NOTE (2026-10-16, verified via Street View): every photo once attributed to
# "301 E Pacific Ave, Villas NJ" actually shows 101 Pennsylvania Ave
# (door number "101" visible; Street View confirms 301 E Pacific is a
# different white cottage). That post was removed; its photos live here.
SHOOTS = [
    dict(slug='101-pennsylvania-ave-villas-nj',
         address='101 Pennsylvania Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='August 2026',
         photos=[('paave_01.jpg', 'Beige Villas NJ bungalow with front deck, American flag and red patio umbrella'),
('paave_02.jpg', 'Drone aerial view of a beige bungalow with deck in Villas NJ'),
('paave_03.jpg', 'Dining room with wooden table, white chairs and bar cart'),
('paave_04.jpg', 'Side view of a beige bungalow with deck and fenced yard in Villas NJ'),
('villas_02_aerial.jpg', 'Drone aerial of Villas NJ neighborhood streets and homes'),
('villas_03_aerial.jpg', 'Aerial view over Villas NJ rooftops and tree-lined streets'),
('101-pennsylvania-ave-villas-nj-open-living.jpg', 'Open living room and kitchen with dark wood floors'),
('101-pennsylvania-ave-villas-nj-kitchen.jpg', 'White kitchen with stainless appliances and gas range'),
('101-pennsylvania-ave-villas-nj-bedroom.jpg', 'Bedroom with soft gray bedding and two windows'),
('101-pennsylvania-ave-villas-nj-bathroom.jpg', 'Bathroom with subway tile shower and round mirror'),
('101-pennsylvania-ave-villas-nj-front-deck.jpg', 'Front deck with outdoor sofa and American flag')],
         blurb='A Villas bungalow with a deck, flag and drone views that show the lot and setting.',
         intro=('This beige bungalow on Pennsylvania Ave in Villas has a big front deck with outdoor seating, a fenced side yard and a bright, open '
 'interior. The shoot covered the open living room and kitchen, the bedrooms and the bathroom, and the drone showed the lot and the '
 'tree-lined Villas streets around it.'),
         highlights=['Front deck with outdoor seating and the American flag',
'Open living room and white kitchen',
'Bedroom and bathroom',
'Deck dining area and fenced side yard',
'Drone aerials over the Villas neighborhood'],
         tags=['Drone aerials', 'HDR interiors', 'Outdoor living']),
    dict(slug='114-catherine-ave-buena-nj',
         address='114 Catherine Ave',
         town='Buena',
         zip='08310',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='2025',
         photos=[('catherine_01_exterior.jpg', 'Two-story Buena NJ home with two-car garage'),
('catherine_02_aerial.jpg', 'Drone aerial of a Buena NJ home and yard'),
('114-catherine-ave-buena-nj-top-down-drone.jpg', 'Top-down drone view of the Buena NJ lot and backyard'),
('114-catherine-ave-buena-nj-living-room.jpg', 'Living room with recliners and dark accent wall'),
('114-catherine-ave-buena-nj-kitchen.jpg', 'Kitchen with sage green cabinets and stainless appliances'),
('114-catherine-ave-buena-nj-dining-room.jpg', 'Dining room with farmhouse table'),
('114-catherine-ave-buena-nj-backyard.jpg', 'Backyard with picnic tables and pergola'),
('114-catherine-ave-buena-nj-back-deck.jpg', 'Back deck overlooking the yard'),
('114-catherine-ave-buena-nj-bathroom.jpg', 'Bathroom with wood vanity and patterned wallpaper'),
('114-catherine-ave-buena-nj-bedroom.jpg', 'Bedroom with big windows and ceiling fan')],
         blurb='Exterior and drone aerial photography in Buena.',
         intro=('This two-story home on Catherine Ave in Buena has a two-car garage, a back deck and a large backyard with picnic tables and a pergola. '
 'The shoot covered the living room, the kitchen with sage green cabinets, the dining room, a bedroom and the bathroom, and the drone '
 'showed the house and the whole backyard from above.'),
         highlights=['Front exterior with two-car garage',
'Top-down drone view of the lot',
'Living room, kitchen and dining room',
'Bedroom and bathroom',
'Back deck, picnic area and pergola'],
         tags=['HDR interiors', 'Drone aerials', 'Outdoor living']),
    dict(slug='601-dove-dr-millville-nj',
         address='601 Dove Dr',
         town='Millville',
         zip='08332',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='2025',
         photos=[('dovedr_01_twilight.jpg', 'Millville NJ mid-century modern home at twilight'),
('dovedr_02_exterior.jpg', 'Mid-century modern home exterior with big lawn in Millville NJ'),
('dovedr_04_aerial_lake.jpg', 'Drone aerial over treetops toward the lake in Millville NJ'),
('dovedr_03_aerial_topdown.jpg', 'Top-down drone view of the Millville NJ property'),
('dovedr_05_aerial_wide.jpg', 'Wide drone aerial over the Millville NJ treetops'),
('dovedr_06_greatroom.jpg', 'Bright great room with fireplace and tall windows'),
('601-dove-dr-millville-nj-kitchen-dining.jpg', 'Open kitchen and dining area with sliding doors to the deck'),
('601-dove-dr-millville-nj-kitchen.jpg', 'Kitchen with maple cabinets and stainless appliances'),
('601-dove-dr-millville-nj-primary-bath.jpg', 'Primary bathroom with double vanity and glass shower'),
('601-dove-dr-millville-nj-sunroom.jpg', 'Sunroom with walls of windows facing the woods'),
('601-dove-dr-millville-nj-back-exterior.jpg', 'Back of the home with deck and lawn'),
('601-dove-dr-millville-nj-foyer.jpg', 'Two-story foyer with staircase'),
('601-dove-dr-millville-nj-bedroom.jpg', 'Bedroom with ceiling fan and dark wood furniture')],
         blurb='Twilight, aerials and interiors for a Millville lakefront property.',
         intro=('601 Dove Dr is a mid-century modern home on a wooded lot near the lake in Millville. The shoot paired a virtual twilight exterior with '
 'drone aerials over the treetops toward the water, then covered the great room, open kitchen and dining area, sunroom, primary bathroom '
 'and two-story foyer inside.'),
         highlights=['Virtual twilight exterior',
'Drone aerials over the treetops toward the lake',
'Great room with fireplace and open kitchen',
'Sunroom, primary bathroom and foyer',
'Back of the home and the lawn'],
         tags=['Virtual twilight', 'Drone aerials', 'Interiors']),
    dict(slug='205-euclid-ave-somers-point-nj',
         address='205 Euclid Ave',
         town='Somers Point',
         zip='08244',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='2025',
         photos=[('euclid_01_aerial.jpg', 'Drone aerial of a Somers Point NJ two-story home'),
('euclid_02_exterior.jpg', 'Two-story Somers Point NJ home with garage and lawn')],
         blurb='Exterior and aerial coverage for this Somers Point listing.'),
    dict(slug='125-e-atlantic-ave-villas-nj',
         address='125 E Atlantic Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='May 2026',
         photos=[('125-e-atlantic-ave-villas-nj-front-exterior.jpg', 'Cream shore cottage with white picket fence and landscaped front yard in Villas NJ'),
('125-e-atlantic-ave-villas-nj-great-room.jpg', 'Open great room with vaulted ceiling and exposed wood beams'),
('125-e-atlantic-ave-villas-nj-kitchen.jpg', 'Kitchen with wood cabinets, granite counters and stainless appliances'),
('125-e-atlantic-ave-villas-nj-living-room.jpg', 'Living area with French doors to the backyard and wall-mounted TV'),
('125-e-atlantic-ave-villas-nj-back-patio.jpg', 'Back patio with outdoor dining set and raised garden beds'),
('125-e-atlantic-ave-villas-nj-backyard-pond.jpg', 'Stone backyard pond under a pergola with a storage shed'),
('125-e-atlantic-ave-villas-nj-bathroom.jpg', 'Bathroom with glass walk-in shower and wood vanity'),
('125-e-atlantic-ave-villas-nj-drone-aerial.jpg', 'Drone aerial over Villas NJ toward the Delaware Bay'),
('125-e-atlantic-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the Villas NJ lot and neighborhood')],
         blurb='A Villas shore cottage with a picket fence, a beamed great room and a backyard pond.',
         intro=('This cottage on E Atlantic Ave sits a few blocks from the Delaware Bay. The interiors are bright with the vaulted, wood-beamed great '
 'room as the centerpiece, and the backyard is the kind of space buyers want to see: a patio dining area, raised garden beds and a stone '
 'pond under a pergola. Drone aerials tie it together by showing how close the home sits to the bay.'),
         highlights=['Front exterior framed by the white picket fence and landscaping',
'Vaulted great room with exposed wood beams',
'Kitchen, living area and bathroom shot with balanced HDR light',
'Back patio, garden beds and the pergola pond',
'Drone aerials toward the Delaware Bay plus a top-down lot view'],
         tags=['HDR interiors', 'Backyard & outdoor living', 'Drone aerials']),
    dict(slug='7710-atlantic-ave-wildwood-nj',
         address='7710 Atlantic Ave Unit 403',
         town='Wildwood',
         zip='08260',
         agent='Alexander M. Powers',
         brokerage='Keller Williams Jersey Shore',
         date='2025',
         desc='Listing Pixl photographed this Wildwood NJ condo at 7710 Atlantic Ave Unit 403. Drone aerials over the beach.',
         photos=[('atlantic_01.jpg', 'Drone aerial over Wildwood NJ beach and oceanfront buildings'),
('atlantic_02.jpg', 'Aerial view of Wildwood beach, ocean and shoreline hotels'),
('atlantic_03.jpg', 'Wide drone aerial of the Wildwood NJ coastline')],
         blurb='Condo listing photography with sweeping aerials in Wildwood.'),
    dict(slug='514-village-rd-villas-nj',
         address='514 Village Rd',
         town='Villas',
         zip='08251',
         agent='Heather Ellen',
         brokerage='',
         date='April 2026',
         photos=[('514-village-rd-villas-nj-bayfront-home.jpg', 'Blue bayfront home with wraparound deck above the Delaware Bay beach in Villas NJ'),
('514-village-rd-villas-nj-bay-side-deck.jpg', 'Bay-side deck and dune path of a beachfront home in Villas NJ'),
('514-village-rd-villas-nj-from-the-water.jpg', 'Bayfront homes along the Villas NJ beach seen from over the water')],
         blurb='Drone photography of a bayfront home on the dunes above the Villas beach.',
         intro=('514 Village Rd is a bayfront home sitting right on the dunes above the Delaware Bay beach in Villas. A property like this sells on its '
 'setting, so the shoot leaned on the drone: the home from the beach side, the deck facing the water and the row of bayfront homes seen '
 'from out over the bay.'),
         highlights=['The home and wraparound deck from just above the beach',
'Bay-side deck and dune path down to the sand',
'The bayfront row seen from over the water',
'Light and angles that show how close the home sits to the bay'],
         tags=['Bayfront drone', 'Beach & water views', 'Edited & MLS-ready']),
    dict(slug='205-st-andrews-dr-cape-may-court-house-nj',
         address='205 St Andrews Dr',
         town='Cape May Court House',
         zip='08210',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='April 2026',
         photos=[('standrews_01_staged_twilight.jpg', 'Cape May Court House NJ townhomes at twilight'),
('standrews_02_twilight.jpg', 'Townhome exteriors glowing at dusk in Cape May Court House NJ'),
('standrews_03_aerial.jpg', 'Drone aerial of a Cape May Court House townhome community'),
('205-st-andrews-dr-cape-may-court-house-nj-living-room.jpg', 'Two-story living room with gas fireplace and tall windows'),
('205-st-andrews-dr-cape-may-court-house-nj-kitchen.jpg', 'White kitchen with breakfast bar and gas range'),
('205-st-andrews-dr-cape-may-court-house-nj-dining-room.jpg', 'Dining room with chandelier and two-tone walls'),
('205-st-andrews-dr-cape-may-court-house-nj-primary-bedroom.jpg', 'Primary bedroom with vaulted ceiling and balcony door'),
('205-st-andrews-dr-cape-may-court-house-nj-primary-bath.jpg', 'Primary bathroom with soaking tub and glass shower'),
('205-st-andrews-dr-cape-may-court-house-nj-balcony.jpg', 'French doors opening to a private balcony'),
('205-st-andrews-dr-cape-may-court-house-nj-top-down-drone.jpg', 'Top-down drone view with the townhome outlined'),
('205-st-andrews-dr-cape-may-court-house-nj-wide-aerial.jpg', 'Wide aerial over the Cape May Court House townhome community'),
('205-st-andrews-dr-cape-may-court-house-nj-back-patio.jpg', 'Covered back patio facing the lawn')],
         blurb='Staged twilight shots and drone aerials in Cape May Court House.',
         intro=('This townhome on St Andrews Dr in Cape May Court House got the full treatment: a virtual twilight of the townhome row, bright interiors '
 'and drone aerials that outline the unit within the community. Inside, the two-story living room with its gas fireplace, the kitchen, the '
 'dining room and the primary suite with its balcony and soaking tub were the highlights.'),
         highlights=['Virtual twilight of the townhome row',
'Two-story living room with gas fireplace',
'Kitchen and dining room',
'Primary bedroom, balcony and primary bathroom',
'Drone aerial with the unit outlined and a wide community shot'],
         tags=['Virtual twilight', 'Drone aerials', 'HDR interiors']),
    dict(slug='15-white-oak-dr-ocean-view-nj',
         address='15 White Oak Dr',
         town='Ocean View',
         zip='08230',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='April 2026',
         photos=[('15-white-oak-dr-ocean-view-nj-front-exterior.jpg', 'Brick-front ranch home with flag and big front lawn in Ocean View NJ'),
('15-white-oak-dr-ocean-view-nj-lot-line-drone.jpg', 'Top-down drone view with the property lines outlined in Ocean View NJ'),
('15-white-oak-dr-ocean-view-nj-wide-aerial.jpg', 'Wide drone aerial over wooded Ocean View NJ neighborhoods'),
('15-white-oak-dr-ocean-view-nj-living-room.jpg', 'Living room with hardwood floors, fireplace and ceiling fan'),
('15-white-oak-dr-ocean-view-nj-kitchen.jpg', 'Gray-cabinet kitchen with granite island and stainless appliances'),
('15-white-oak-dr-ocean-view-nj-family-room.jpg', 'Family room with teal walls, wood accent wall and French doors'),
('15-white-oak-dr-ocean-view-nj-dining-room.jpg', 'Dining room with farmhouse table and hardwood floors'),
('15-white-oak-dr-ocean-view-nj-primary-bedroom.jpg', 'Primary bedroom with ceiling fan and wood dressers'),
('15-white-oak-dr-ocean-view-nj-deck-gazebo.jpg', 'Back deck with gazebo and grill'),
('15-white-oak-dr-ocean-view-nj-backyard.jpg', 'Large backyard with lawn and tree line')],
         blurb='Interiors, a deck with a gazebo and lot-line drone shots for an Ocean View ranch.',
         intro=('This brick-front ranch on White Oak Dr sits on a big wooded lot in Ocean View. The interiors cover every main room, from the living room '
 'with its fireplace to a kitchen with a granite island, and the backyard deck with its gazebo shows off the outdoor space. A top-down '
 'drone view with the property lines drawn in shows buyers exactly how much land comes with the home.'),
         highlights=['Front exterior with the big lawn',
'Living room, kitchen, family room and dining room',
'Primary bedroom',
'Back deck with gazebo and the open backyard',
'Lot-line drone view and a wide aerial over Ocean View'],
         tags=['HDR interiors', 'Lot-line drone view', 'Outdoor living']),
    dict(slug='124-w-new-york-ave-villas-nj',
         address='124 W New York Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='March 2026',
         photos=[('nyave_01.jpg', 'Light blue Villas NJ cottage with red shutters at twilight'),
('nyave_02.jpg', 'Top-down drone view of a Villas NJ property with outlined lot'),
('nyave_03.jpg', 'Drone aerial toward the bay over Villas NJ'),
('124-w-new-york-ave-villas-nj-front-yard.jpg', 'Light blue cottage with red shutters and landscaped stone yard in Villas NJ'),
('124-w-new-york-ave-villas-nj-living-room.jpg', 'Coral living room with blue sectional and coastal art'),
('124-w-new-york-ave-villas-nj-kitchen.jpg', 'Kitchen with blue cabinets, round table and stainless fridge'),
('124-w-new-york-ave-villas-nj-palm-mural.jpg', 'Kitchen corner with palm tree mural and open shelving'),
('124-w-new-york-ave-villas-nj-green-bedroom.jpg', 'Green bedroom with palm-leaf bedding'),
('124-w-new-york-ave-villas-nj-yellow-bedroom.jpg', 'Yellow bedroom with twin beds and rattan headboard'),
('124-w-new-york-ave-villas-nj-bathroom.jpg', 'Bathroom with bold blue wave tile'),
('124-w-new-york-ave-villas-nj-back-deck.jpg', 'Back deck with outdoor dining table'),
('124-w-new-york-ave-villas-nj-fire-pit.jpg', 'Gravel fire pit area with blue Adirondack chairs'),
('124-w-new-york-ave-villas-nj-shed.jpg', 'Light blue shed with pink doors')],
         blurb='Full HDR coverage plus a twilight exterior in Villas.',
         intro=("This light blue cottage on W New York Ave in Villas has red shutters, a landscaped stone yard and some of the boldest interiors we've "
 'shot: a coral living room, a kitchen with blue cabinets and a palm tree mural, and a bathroom with blue wave tile. The drone outlined '
 'the lot and showed the bay beyond the neighborhood.'),
         highlights=['Virtual twilight and daytime exteriors',
'Coral living room and blue-cabinet kitchen',
'Palm tree mural, green bedroom and yellow bedroom',
'Bathroom with blue wave tile',
'Back deck, fire pit, shed and lot-line drone view'],
         tags=['Virtual twilight', 'HDR interiors', 'Drone aerials']),
    dict(slug='10-williams-way-ocean-view-nj',
         address='10 Williams Way',
         town='Ocean View',
         zip='08230',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='March 2026',
         photos=[('williamsway_01_twilight.jpg', 'Two-story colonial home at twilight in Ocean View NJ'),
('williamsway_02_twilight.jpg', 'Front exterior of an Ocean View NJ home at dusk'),
('10-williams-way-ocean-view-nj-top-down-drone.jpg', 'Top-down drone view of the Ocean View NJ lot'),
('10-williams-way-ocean-view-nj-wide-aerial.jpg', 'Wide drone aerial over wooded Ocean View NJ neighborhoods'),
('10-williams-way-ocean-view-nj-kitchen.jpg', 'White kitchen with butcher block island and stainless appliances'),
('10-williams-way-ocean-view-nj-family-room.jpg', 'Family room with sectional and built-in entertainment wall'),
('10-williams-way-ocean-view-nj-living-room.jpg', 'Living room with hardwood floors and big windows'),
('10-williams-way-ocean-view-nj-primary-bedroom.jpg', 'Primary bedroom with ceiling fan'),
('10-williams-way-ocean-view-nj-bathroom.jpg', 'Bathroom with wood vanity and black fixtures'),
('10-williams-way-ocean-view-nj-pergola-fire-pit.jpg', 'Backyard pergola, fire pit and grill area'),
('10-williams-way-ocean-view-nj-multi-level-deck.jpg', 'Multi-level deck and above-ground pool'),
('10-williams-way-ocean-view-nj-backyard.jpg', 'Big backyard with play set and pool')],
         blurb='Virtual twilight exteriors for this Ocean View listing.',
         services_note=('HDR listing photography with professional editing and color correction, delivered next-day and sized ready for the MLS, plus virtual '
 'twilight exteriors that make the listing stand out online.'),
         intro=('10 Williams Way is a two-story colonial in Ocean View with a big backyard built for summer: a pergola, fire pit, multi-level deck and '
 'above-ground pool. The virtual twilight exterior leads the gallery, followed by the kitchen with its butcher block island, the family '
 'room, living room, primary bedroom, a bathroom and drone views of the wooded lot.'),
         highlights=['Virtual twilight exteriors',
'Top-down drone view and wide aerial over Ocean View',
'Kitchen with butcher block island',
'Family room, living room, primary bedroom and bathroom',
'Pergola, fire pit, multi-level deck and pool'],
         tags=['Virtual twilight exteriors', 'HDR photos', 'Outdoor living']),
    dict(slug='15-n-11th-st-villas-nj',
         address='15 N 11th St',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='February 2026',
         photos=[('15-n-11th-st-villas-nj-virtual-twilight.jpg', 'Green ranch home at virtual twilight in Villas NJ'),
('15-n-11th-st-villas-nj-drone-front.jpg', 'Drone view of the Villas NJ ranch and yard'),
('15-n-11th-st-villas-nj-aerial-bay.jpg', 'Drone aerial over Villas NJ toward the Delaware Bay and marsh'),
('15-n-11th-st-villas-nj-kitchen.jpg', 'Kitchen with white cabinets and reclaimed wood accent wall'),
('15-n-11th-st-villas-nj-living-room.jpg', 'Living room with fireplace TV wall and sliding door'),
('15-n-11th-st-villas-nj-dining-room.jpg', 'Dining area with knotty pine ceiling'),
('15-n-11th-st-villas-nj-bedroom.jpg', 'Bedroom with blue curtains and wood accent beam'),
('15-n-11th-st-villas-nj-bathroom.jpg', 'Bathroom with tub and wainscoting'),
('15-n-11th-st-villas-nj-shed.jpg', 'Blue backyard sheds')],
         blurb='',
         intro=('15 N 11th St is a green ranch in Villas photographed in winter. The virtual twilight gives the exterior a warm glow, and the drone '
 'aerials show the home, the yard and the bay and marsh just beyond the neighborhood. Inside, the shoot covered the kitchen with its '
 'reclaimed wood accent wall, the living room, dining area, a bedroom and the bathroom.'),
         highlights=['Virtual twilight exterior',
'Drone view of the home and an aerial toward the bay and marsh',
'Kitchen with reclaimed wood accent wall',
'Living room and dining area',
'Bedroom, bathroom and backyard sheds'],
         tags=['Virtual twilight', 'Drone aerials', 'HDR interiors']),
    dict(slug='218-rio-grande-ave-wildwood-nj',
         address='218 Rio Grande Ave',
         town='Wildwood',
         zip='08260',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='February 2026',
         photos=[('riogrande_01_twilight.jpg', 'Wildwood NJ beach house glowing at twilight'),
('riogrande_02_drone_twilight.jpg', 'Drone aerial of a Wildwood NJ street at twilight'),
('218-rio-grande-ave-wildwood-nj-front-exterior.jpg', 'Three-story Wildwood NJ shore home with stacked balconies and two-car garage'),
('218-rio-grande-ave-wildwood-nj-aerial-ocean.jpg', 'Drone aerial down Rio Grande Ave toward the Wildwood beach and ocean'),
('218-rio-grande-ave-wildwood-nj-living-room.jpg', 'Living room with sectional sofa and teal accent wall'),
('218-rio-grande-ave-wildwood-nj-kitchen-island.jpg', 'Kitchen island with bar seating and granite counters'),
('218-rio-grande-ave-wildwood-nj-kitchen.jpg', 'Kitchen with maple cabinets, gas range and stainless appliances'),
('218-rio-grande-ave-wildwood-nj-dining-room.jpg', 'Dining area with sliding doors to the balcony'),
('218-rio-grande-ave-wildwood-nj-bedroom.jpg', 'Teal bedroom with queen bed'),
('218-rio-grande-ave-wildwood-nj-bunk-room.jpg', 'Bunk room with twin-over-full bunk bed'),
('218-rio-grande-ave-wildwood-nj-bathroom.jpg', 'Bathroom with double-sink vanity'),
('218-rio-grande-ave-wildwood-nj-covered-balcony.jpg', 'Covered balcony with street views'),
('218-rio-grande-ave-wildwood-nj-pool-deck.jpg', 'Backyard pool and deck with privacy fence')],
         blurb='Scroll-stopping virtual twilights with drone coverage in Wildwood.',
         intro=('218 Rio Grande Ave is a three-story Wildwood shore home with stacked balconies, a two-car garage and a backyard pool. The virtual '
 'twilight and drone twilight lead the gallery, followed by a daytime drone shot down Rio Grande Ave to the beach and the living room, '
 'kitchen, bedrooms, bunk room, balcony and pool deck.'),
         highlights=['Virtual twilight exterior and drone twilight',
'Drone aerial down Rio Grande Ave toward the ocean',
'Living room, kitchen and dining area',
'Bedroom, bunk room and bathroom',
'Covered balcony and backyard pool'],
         tags=['Virtual twilight exteriors', 'Virtual twilight aerial', 'Edited & MLS-ready']),
    dict(slug='101-rutledge-ave-villas-nj',
         address='101 Rutledge Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='February 2026',
         photos=[('101-rutledge-ave-villas-nj-front-exterior.jpg', 'Green two-story Villas NJ home with garage and front stairs'),
('101-rutledge-ave-villas-nj-drone-sunset.jpg', 'Drone aerial at sunset over the home and the bayside marsh'),
('101-rutledge-ave-villas-nj-living-room.jpg', 'Light blue living room with fireplace and two sofas'),
('101-rutledge-ave-villas-nj-dining-kitchen.jpg', 'Dining area open to a white kitchen'),
('101-rutledge-ave-villas-nj-kitchen.jpg', 'White kitchen with granite counters and stainless appliances'),
('101-rutledge-ave-villas-nj-deck.jpg', 'Second-floor deck with fire table and wicker chairs'),
('101-rutledge-ave-villas-nj-jetted-tub.jpg', 'Primary bathroom with jetted tub and glass shower'),
('101-rutledge-ave-villas-nj-primary-bedroom.jpg', 'Primary bedroom with starfish wall decor'),
('101-rutledge-ave-villas-nj-garage-bar.jpg', 'Garage converted to a game room and bar')],
         blurb='',
         intro=('101 Rutledge Ave is a two-story home in Villas next to the bayside marsh. A sunset drone aerial over the marsh leads the gallery, '
 'followed by the living room with its fireplace, the white kitchen and dining area, the second-floor deck, the primary bedroom, the '
 'bathroom with a jetted tub and a garage turned game room and bar.'),
         highlights=['Front exterior and sunset drone aerial over the marsh',
'Living room with fireplace',
'White kitchen and dining area',
'Second-floor deck and primary bedroom',
'Jetted tub bathroom and garage bar'],
         tags=['Drone aerials', 'HDR interiors', 'Decluttered photos']),
    dict(slug='116-w-wilde-ave-villas-nj',
         address='116 W Wilde Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='January 2026',
         photos=[('116-w-wilde-ave-villas-nj-virtual-twilight.jpg', 'New construction Villas NJ home at virtual twilight'),
('116-w-wilde-ave-villas-nj-exterior.jpg', 'White two-story new build with front porch in Villas NJ'),
('116-w-wilde-ave-villas-nj-lot-line-drone.jpg', 'Top-down drone view with the lot lines outlined'),
('116-w-wilde-ave-villas-nj-kitchen.jpg', 'Kitchen with white and walnut cabinets and quartz island'),
('116-w-wilde-ave-villas-nj-open-living.jpg', 'Open floor plan with white oak floors'),
('116-w-wilde-ave-villas-nj-primary-shower.jpg', 'Marble walk-in shower with bench'),
('116-w-wilde-ave-villas-nj-tub.jpg', 'Soaking tub with teal herringbone tile'),
('116-w-wilde-ave-villas-nj-deck.jpg', 'Back deck with white railings'),
('116-w-wilde-ave-villas-nj-virtually-staged-living.jpg', 'Virtually staged living room'),
('116-w-wilde-ave-villas-nj-drone-aerial.jpg', 'Drone aerial of the new build and neighborhood')],
         blurb='',
         intro=('116 W Wilde Ave is a new construction home in Villas. A virtual twilight leads the gallery, and the shoot covers the two-tone kitchen '
 'with its quartz island, the open floor plan with white oak floors, the marble walk-in shower and the soaking tub with teal herringbone '
 'tile. A virtually staged living room shows buyers how the empty space can live, and the drone outlines the lot.'),
         highlights=['Virtual twilight and daytime exteriors',
'Kitchen with quartz island and open floor plan',
'Marble walk-in shower and soaking tub',
'Virtually staged living room',
'Back deck, lot-line drone view and aerial'],
         tags=['New construction', 'Virtual staging', 'Drone aerials']),
    dict(slug='414-paradise-way-north-wildwood-nj',
         address='414 Paradise Way',
         town='North Wildwood',
         zip='08260',
         agent='Dave Emerson',
         brokerage='eXp Realty',
         date='October 2025',
         photos=[('paradiseway_01_staged.jpg', 'North Wildwood NJ townhomes glowing at twilight'),
('paradiseway_02_drone.jpg', 'Drone aerial of a North Wildwood townhome row'),
('414-paradise-way-north-wildwood-nj-bay-aerial.jpg', 'Drone aerial of bayfront townhomes on the water in North Wildwood NJ'),
('414-paradise-way-north-wildwood-nj-marsh-aerial.jpg', 'Aerial over the North Wildwood NJ back bay and marshes'),
('414-paradise-way-north-wildwood-nj-bay-view.jpg', 'Bay and marsh view from the waterfront patio'),
('414-paradise-way-north-wildwood-nj-living-room.jpg', 'Living room with gas fireplace and coastal decor'),
('414-paradise-way-north-wildwood-nj-dining-room.jpg', 'Dining room with chandelier and farmhouse table'),
('414-paradise-way-north-wildwood-nj-kitchen.jpg', 'White kitchen with marble island and stainless appliances'),
('414-paradise-way-north-wildwood-nj-primary-bedroom.jpg', 'Primary bedroom with sliding doors to the bay-view deck'),
('414-paradise-way-north-wildwood-nj-primary-bath.jpg', 'Primary bathroom with glass shower and double vanity'),
('414-paradise-way-north-wildwood-nj-sunset-balcony.jpg', 'Sunset over the bay from a balcony with Adirondack chairs'),
('414-paradise-way-north-wildwood-nj-covered-balcony.jpg', 'Covered balcony with rocking chairs and bay views'),
('414-paradise-way-north-wildwood-nj-floor-plans.jpg', 'Measured floor plans for all three levels')],
         blurb='Twilight exteriors plus drone aerials for this North Wildwood townhome.',
         intro=('414 Paradise Way is a bayfront townhome in North Wildwood that looks out over the back bay and marshes. The shoot covered the views from '
 'every balcony, including a bay sunset, along with the living room with its gas fireplace, the white marble kitchen, the dining room and '
 'the primary suite. Drone aerials and measured floor plans for all three levels round out the listing.'),
         highlights=['Virtual twilight exterior and drone aerials of the bay',
'Bay and marsh views from the waterfront patio',
'Living room, dining room and marble kitchen',
'Primary bedroom and primary bathroom',
'Sunset balcony, covered balcony and floor plans'],
         tags=['Virtual twilight', 'Drone aerials', 'Floor plans']),
    dict(slug='26-lomurno-ln-cape-may-court-house-nj',
         address='26 Lomurno Ln',
         town='Cape May Court House',
         zip='08210',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='August 2025',
         photos=[('26-lomurno-ln-cape-may-court-house-nj-front-exterior.jpg', 'Ranch home on a large wooded lot in Cape May Court House NJ'),
('26-lomurno-ln-cape-may-court-house-nj-pool-house.jpg', 'Back of the home with fenced inground pool'),
('26-lomurno-ln-cape-may-court-house-nj-inground-pool.jpg', 'Inground pool with fence and lounge area'),
('26-lomurno-ln-cape-may-court-house-nj-top-down-drone.jpg', 'Top-down drone view of the home, pool and garage'),
('26-lomurno-ln-cape-may-court-house-nj-detached-garage.jpg', 'Detached two-car garage with paved driveway'),
('26-lomurno-ln-cape-may-court-house-nj-sunroom.jpg', 'Bright great room with vaulted ceiling and arched window'),
('26-lomurno-ln-cape-may-court-house-nj-kitchen.jpg', 'Maple kitchen with granite counters and stainless appliances'),
('26-lomurno-ln-cape-may-court-house-nj-living-room.jpg', 'Living room with fireplace and wood mantel'),
('26-lomurno-ln-cape-may-court-house-nj-bathroom.jpg', 'Bathroom with marble vanity and wainscoting'),
('26-lomurno-ln-cape-may-court-house-nj-wishing-well.jpg', 'Wishing well and driveway leading to the garage and pool')],
         blurb='A Cape May Court House ranch with an inground pool, detached garage and a big wooded lot.',
         intro=('26 Lomurno Ln is a ranch on a large lot in Cape May Court House with an inground pool, a detached two-car garage and plenty of mature '
 'trees. The shoot covered the bright great room, kitchen and living room inside, then moved outside for the pool area and a top-down '
 'drone view that shows the house, pool and garage together.'),
         highlights=['Front exterior on the wooded lot',
'Fenced inground pool from two angles',
'Great room with vaulted ceiling and arched window',
'Kitchen, living room with fireplace and bathroom',
'Top-down drone view of the home, pool and garage'],
         tags=['Pool & outdoor', 'HDR interiors', 'Drone aerials']),
    dict(slug='320-oakdale-ave-villas-nj',
         address='320 Oakdale Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='September 2025',
         photos=[('320-oakdale-ave-villas-nj-front-exterior.jpg', 'Ranch home with front porch and Italian cypress trees in Villas NJ'),
('320-oakdale-ave-villas-nj-drone-front.jpg', 'Drone view of the home, driveway and front lawn in Villas NJ'),
('320-oakdale-ave-villas-nj-aerial-bay.jpg', 'Aerial over Villas NJ toward the Delaware Bay'),
('320-oakdale-ave-villas-nj-living-room.jpg', 'Living room with hardwood floors and sectional sofa'),
('320-oakdale-ave-villas-nj-kitchen.jpg', 'Cherry kitchen with island and stainless appliances'),
('320-oakdale-ave-villas-nj-dining-room.jpg', 'Dining area beside the kitchen island'),
('320-oakdale-ave-villas-nj-bedroom.jpg', 'Bedroom with ceiling fan and dark wood furniture'),
('320-oakdale-ave-villas-nj-skylight-bath.jpg', 'Bathroom with skylight and glass shower'),
('320-oakdale-ave-villas-nj-front-porch.jpg', 'Covered front porch with seating'),
('320-oakdale-ave-villas-nj-back-deck.jpg', 'Back deck with sliding doors and lounge chairs')],
         blurb='A Villas ranch with a front porch, a cherry kitchen and aerials toward the bay.',
         intro=('320 Oakdale Ave is a ranch in Villas with a covered front porch, Italian cypress trees out front and a back deck. Inside, the shoot '
 'covered the living room, the cherry kitchen with its island, the dining area, a bedroom and a bathroom with a skylight. Drone shots show '
 'the front of the home and the short distance to the Delaware Bay.'),
         highlights=['Front exterior and drone view of the home and driveway',
'Aerial over Villas toward the Delaware Bay',
'Living room, kitchen with island and dining area',
'Bedroom and a bathroom with skylight',
'Covered front porch and back deck'],
         tags=['HDR interiors', 'Drone aerials', 'Porch & deck']),
    dict(slug='606-new-jersey-ave-north-wildwood-nj',
         services_note='commercial real estate photography of the storefront, sales floor and back rooms with professional editing, drone aerials showing the location on New Jersey Ave, and a measured floor plan of the space.',
         address='606 New Jersey Ave',
         town='North Wildwood',
         zip='08260',
         agent='Jennifer McGuire',
         brokerage='',
         date='August 2025',
         photos=[('606-new-jersey-ave-north-wildwood-nj-storefront.jpg', 'Retail storefront entrance on New Jersey Ave in North Wildwood NJ'),
('606-new-jersey-ave-north-wildwood-nj-drone-aerial.jpg',
'Drone aerial over North Wildwood NJ with the Welcome to North Wildwood water tower'),
('606-new-jersey-ave-north-wildwood-nj-sales-floor.jpg', 'Retail sales floor with display counters and wall shelving'),
('606-new-jersey-ave-north-wildwood-nj-walk-in-room.jpg', 'Walk-in room lined with wood shelving and a wood plank ceiling'),
('606-new-jersey-ave-north-wildwood-nj-street-aerial.jpg', 'Aerial of New Jersey Ave and the surrounding North Wildwood blocks'),
('606-new-jersey-ave-north-wildwood-nj-floor-plan.jpg', 'Measured floor plan of the North Wildwood retail space')],
         blurb='Commercial photography, drone aerials and a floor plan for a North Wildwood storefront.',
         intro=('Not every shoot is a house. 606 New Jersey Ave is a retail storefront in North Wildwood, and the job called for commercial real estate '
 'photography: the storefront, the sales floor and the back rooms, plus drone aerials that show the location on New Jersey Ave with the '
 'Welcome to North Wildwood water tower in view. A measured floor plan rounds out the listing.'),
         highlights=['Storefront entrance from the street',
'Sales floor with display counters and shelving',
'Back room with wood shelving and plank ceiling',
'Drone aerials of New Jersey Ave and the North Wildwood blocks',
'Measured floor plan of the space'],
         tags=['Commercial photography', 'Drone aerials', 'Floor plan']),
    dict(slug='430-w-pine-ave-wildwood-nj',
         address='430 W Pine Ave',
         town='Wildwood',
         zip='08260',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='June 2025',
         photos=[('430-w-pine-ave-wildwood-nj-front-exterior.jpg', 'Two-story Wildwood NJ shore home with balconies and garage'),
('430-w-pine-ave-wildwood-nj-drone-location.jpg', 'Drone aerial of a Wildwood NJ neighborhood with the home marked'),
('430-w-pine-ave-wildwood-nj-street-aerial.jpg', 'Aerial view of the home and street in Wildwood NJ'),
('430-w-pine-ave-wildwood-nj-living-room.jpg', 'Open living room with gas fireplace and kitchen bar seating'),
('430-w-pine-ave-wildwood-nj-kitchen.jpg', 'White kitchen with granite island'),
('430-w-pine-ave-wildwood-nj-primary-bedroom.jpg', 'Primary bedroom with sliding door to the balcony'),
('430-w-pine-ave-wildwood-nj-swim-spa.jpg', 'Backyard swim spa with steps to the deck'),
('430-w-pine-ave-wildwood-nj-covered-balcony.jpg', 'Covered balcony with outdoor seating'),
('430-w-pine-ave-wildwood-nj-walk-in-shower.jpg', 'Tiled walk-in shower with bench')],
         blurb='A two-story Wildwood shore home with balconies and a backyard swim spa.',
         intro=('This Wildwood shore home on W Pine Ave has covered balconies, an open living room with a gas fireplace and a backyard swim spa. Drone '
 'shots mark the home on the map of the neighborhood so buyers can see where it sits in Wildwood, and the interiors cover the living room, '
 'kitchen, primary bedroom and the tiled walk-in shower.'),
         highlights=['Front exterior with balconies and garage',
'Drone aerial with the home marked in the neighborhood',
'Open living room with gas fireplace',
'White kitchen with granite island',
'Swim spa, covered balcony and walk-in shower'],
         tags=['Drone location shots', 'HDR interiors', 'Outdoor living']),
    dict(slug='110-w-wilde-ave-villas-nj',
         address='110 W Wilde Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='April 2025',
         photos=[('110-w-wilde-ave-villas-nj-front-exterior.jpg', 'Renovated yellow ranch home with new driveway and garage in Villas NJ'),
('110-w-wilde-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the Villas NJ lot and roofline'),
('110-w-wilde-ave-villas-nj-aerial-bay.jpg', 'Drone aerial over Villas NJ toward the Delaware Bay'),
('110-w-wilde-ave-villas-nj-aerial-marked.jpg', 'Drone aerial of the Villas NJ neighborhood with the home marked'),
('110-w-wilde-ave-villas-nj-kitchen.jpg', 'White shaker kitchen with stainless appliances and tile backsplash'),
('110-w-wilde-ave-villas-nj-kitchen-wide.jpg', 'Renovated kitchen with wide-plank floors and window over the yard'),
('110-w-wilde-ave-villas-nj-living-room.jpg', 'Open living space with new hardwood floors'),
('110-w-wilde-ave-villas-nj-bathroom.jpg', 'Bathroom with wood vanity, gold fixtures and backlit mirror'),
('110-w-wilde-ave-villas-nj-outdoor-shower.jpg', 'Cedar outdoor shower beside the home'),
('110-w-wilde-ave-villas-nj-backyard.jpg', 'Backyard with red storage shed')],
         blurb='A renovated Villas ranch with a new kitchen, an outdoor shower and drone aerials toward the bay.',
         intro=('This yellow ranch on W Wilde Ave in Villas was freshly renovated, and the photos needed to show the new work. The shoot covered the '
 'white shaker kitchen from two angles, the open living space with new floors and the updated bathroom, then stepped outside for the cedar '
 "outdoor shower and backyard. Drone aerials show the lot from above and the home's spot a short drive from the bay."),
         highlights=['Front exterior with the new driveway and garage',
'White shaker kitchen and wide-plank floors',
'Open living space and updated bathroom',
'Cedar outdoor shower and backyard shed',
'Top-down drone view and aerials toward the Delaware Bay'],
         tags=['Renovation showcase', 'HDR interiors', 'Drone aerials']),
    dict(slug='108-w-harrison-ave-millville-nj',
         address='108 W Harrison Ave',
         town='Millville',
         zip='08332',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='February 2025',
         photos=[('108-w-harrison-ave-millville-nj-front-exterior.jpg', 'Cape Cod style home on a large lot in Millville NJ'),
('108-w-harrison-ave-millville-nj-top-down-drone.jpg', 'Top-down drone view of the Millville NJ home and inground pool'),
('108-w-harrison-ave-millville-nj-wide-aerial.jpg', 'Wide drone aerial over Millville NJ neighborhoods'),
('108-w-harrison-ave-millville-nj-inground-pool.jpg', 'Inground pool behind the home with sunroom windows'),
('108-w-harrison-ave-millville-nj-deck-dining.jpg', 'Back deck with outdoor dining table'),
('108-w-harrison-ave-millville-nj-living-room.jpg', 'Two-story living room with loft balcony'),
('108-w-harrison-ave-millville-nj-sunroom.jpg', 'Sunroom with walls of windows and slate floor'),
('108-w-harrison-ave-millville-nj-kitchen.jpg', 'Knotty pine kitchen with peninsula and slate floor'),
('108-w-harrison-ave-millville-nj-family-room.jpg', 'Wood-paneled family room with sliding doors to the yard'),
('108-w-harrison-ave-millville-nj-upstairs-bedroom.jpg', 'Upstairs bedroom with skylights and sloped ceiling'),
('108-w-harrison-ave-millville-nj-bathroom.jpg', 'Bathroom with jetted tub and tile surround')],
         blurb='A Millville Cape Cod with an inground pool, a two-story living room and a sunroom.',
         intro=('108 W Harrison Ave is a Cape Cod style home in Millville with an inground pool, a back deck and a sunroom lined with windows. The '
 'interiors have a lot of character, from the two-story living room with a loft balcony to the knotty pine kitchen and the wood-paneled '
 'family room, so the shoot covered each one, plus a top-down drone view of the home and pool.'),
         highlights=['Front exterior and a wide aerial over Millville',
'Top-down drone view of the home and inground pool',
'Two-story living room with loft balcony',
'Sunroom, knotty pine kitchen and family room',
'Back deck dining area, upstairs bedroom and bathroom'],
         tags=['Pool & outdoor', 'HDR interiors', 'Drone aerials']),
    dict(slug='1140-pixwhey-ct-vineland-nj',
         address='1140 Pixwhey Ct',
         town='Vineland',
         zip='08361',
         agent='Jason Ruffenach',
         brokerage='eXp Realty',
         date='February 2025',
         photos=[('1140-pixwhey-ct-vineland-nj-front-exterior.jpg', 'Two-story colonial with two-car garage and wraparound porch in Vineland NJ'),
('1140-pixwhey-ct-vineland-nj-drone-front.jpg', 'Drone view of the Vineland NJ home, driveway and fenced yard'),
('1140-pixwhey-ct-vineland-nj-top-down-drone.jpg', 'Top-down drone view of the Vineland NJ lot and backyard'),
('1140-pixwhey-ct-vineland-nj-wide-aerial.jpg', 'Wide drone aerial over Vineland NJ neighborhoods'),
('1140-pixwhey-ct-vineland-nj-living-room.jpg', 'Two-story living room with arched window and sectional sofa'),
('1140-pixwhey-ct-vineland-nj-dining-room.jpg', 'Dining room with chandelier and big windows'),
('1140-pixwhey-ct-vineland-nj-kitchen.jpg', 'Oak kitchen with white appliances and pantry'),
('1140-pixwhey-ct-vineland-nj-basement-family-room.jpg', 'Finished basement family room with recessed lighting'),
('1140-pixwhey-ct-vineland-nj-primary-bedroom.jpg', 'Primary bedroom with vaulted ceiling'),
('1140-pixwhey-ct-vineland-nj-primary-bath.jpg', 'Primary bathroom with double vanity and corner tub'),
('1140-pixwhey-ct-vineland-nj-covered-porch.jpg', 'Covered front porch with Adirondack chairs'),
('1140-pixwhey-ct-vineland-nj-paver-patio.jpg', 'Paver patio and large fenced backyard')],
         blurb='A Vineland colonial with a two-story living room, finished basement and fenced backyard.',
         intro=('This two-story colonial on Pixwhey Ct in Vineland has a covered front porch, a two-car garage and a large fenced backyard with a paver '
 'patio. The shoot covered the two-story living room, the dining room, kitchen, finished basement family room and the primary suite, with '
 'drone views showing the home, driveway and backyard from above.'),
         highlights=['Front exterior and covered front porch',
'Two-story living room with arched window',
'Dining room, kitchen and finished basement',
'Primary bedroom and primary bathroom',
'Drone views of the lot and paver patio'],
         tags=['HDR interiors', 'Drone aerials', 'Outdoor living']),
    dict(slug='604-scott-ave-north-cape-may-nj',
         address='604 Scott Ave',
         town='North Cape May',
         zip='08204',
         agent='Andri',
         brokerage='',
         date='December 2024',
         photos=[('604-scott-ave-north-cape-may-nj-front-exterior.jpg', 'Gray ranch home with dark shutters in North Cape May NJ'),
('604-scott-ave-north-cape-may-nj-drone-corner-lot.jpg', 'Drone aerial of the North Cape May NJ ranch on its corner lot'),
('604-scott-ave-north-cape-may-nj-top-down-drone.jpg', 'Top-down drone view of the North Cape May NJ lot and detached garage'),
('604-scott-ave-north-cape-may-nj-wide-aerial.jpg', 'Wide drone aerial over North Cape May NJ toward the bay'),
('604-scott-ave-north-cape-may-nj-kitchen.jpg', 'Kitchen with oak cabinets and new stainless appliances'),
('604-scott-ave-north-cape-may-nj-living-room.jpg', 'Freshly painted living room opening to the kitchen'),
('604-scott-ave-north-cape-may-nj-sunroom.jpg', 'Enclosed sunroom with windows on three sides'),
('604-scott-ave-north-cape-may-nj-detached-garage.jpg', 'Driveway and detached one-car garage'),
('604-scott-ave-north-cape-may-nj-backyard.jpg', 'Back of the home and yard'),
('604-scott-ave-north-cape-may-nj-bathroom.jpg', 'Bathroom with tub and shower combo')],
         blurb='A North Cape May ranch on a corner lot with a sunroom and detached garage.',
         intro=('604 Scott Ave is a gray ranch on a corner lot in North Cape May with a detached garage and an enclosed sunroom. The shoot covered the '
 'kitchen with its new stainless appliances, the freshly painted living room, the sunroom and the bathroom, and used the drone to show the '
 'corner lot and the short trip to the bay.'),
         highlights=['Front exterior with dark shutters',
'Drone aerials of the corner lot and garage',
'Wide aerial toward the bay',
'Kitchen, living room and sunroom',
'Backyard and bathroom'],
         tags=['HDR interiors', 'Drone aerials', 'Edited & MLS-ready']),
    dict(slug='38-alexander-ave-villas-nj',
         address='38 Alexander Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='',
         date='September 2024',
         photos=[('38-alexander-ave-villas-nj-front-exterior.jpg', 'Renovated cottage with white front porch on a big lawn in Villas NJ'),
('38-alexander-ave-villas-nj-drone-front.jpg', 'Drone view of the Villas NJ cottage and long driveway'),
('38-alexander-ave-villas-nj-aerial-bay.jpg', 'Drone aerial over Villas NJ toward the Delaware Bay with the home marked'),
('38-alexander-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the Villas NJ property'),
('38-alexander-ave-villas-nj-living-room.jpg', 'Open living space with cherry hardwood floors and recessed lighting'),
('38-alexander-ave-villas-nj-kitchen.jpg', 'Kitchen with quartz counters, mosaic backsplash and stainless appliances'),
('38-alexander-ave-villas-nj-kitchen-range.jpg', 'Cream cabinets and gas range in the renovated kitchen'),
('38-alexander-ave-villas-nj-bathroom.jpg', 'Bathroom with glass-door tub shower and subway tile'),
('38-alexander-ave-villas-nj-finished-attic.jpg', 'Finished upstairs bonus room with sloped ceilings'),
('38-alexander-ave-villas-nj-fire-pit-patio.jpg', 'Backyard patio with fire pit and privacy fence'),
('38-alexander-ave-villas-nj-back-deck.jpg', 'Stained wood back deck with sliding doors'),
('38-alexander-ave-villas-nj-front-porch.jpg', 'Front porch with white railings')],
         blurb='A renovated Villas cottage with a quartz kitchen, a bonus room and a fire pit patio.',
         intro=('This renovated cottage on Alexander Ave in Villas has a white front porch, a long driveway and a fenced backyard with a fire pit patio '
 'and stained deck. Inside, the open living space flows into a kitchen with quartz counters and a gas range, and the finished upstairs '
 'bonus room adds extra space. Drone shots mark the home and show the Delaware Bay just beyond the neighborhood.'),
         highlights=['Front exterior and front porch',
'Drone views with the home marked and the bay in the distance',
'Open living space and renovated kitchen',
'Bathroom and finished upstairs bonus room',
'Fire pit patio and back deck'],
         tags=['Renovation showcase', 'Drone aerials', 'Outdoor living']),
    dict(slug='216-iselin-rd-cape-may-nj',
         address='216 Iselin Rd',
         town='Cape May',
         zip='08204',
         agent='Jason Ruffenach',
         brokerage='',
         date='June 2024',
         photos=[('216-iselin-rd-cape-may-nj-front-exterior.jpg', 'Cape Cod home on a large lawn in Cape May NJ'),
('216-iselin-rd-cape-may-nj-lot-line-drone.jpg', 'Drone view with property lines outlined on a large wooded lot in Cape May NJ'),
('216-iselin-rd-cape-may-nj-aerial-bay.jpg', 'Drone aerial toward the Delaware Bay with the lot outlined'),
('216-iselin-rd-cape-may-nj-street-view.jpg', 'Street view of the home behind mature trees'),
('216-iselin-rd-cape-may-nj-living-room.jpg', 'Knotty pine living room with big picture window'),
('216-iselin-rd-cape-may-nj-kitchen.jpg', 'Wood-paneled kitchen with gas range and stainless fridge'),
('216-iselin-rd-cape-may-nj-bathroom.jpg', 'Updated bathroom with glass shower and white vanity'),
('216-iselin-rd-cape-may-nj-bedroom.jpg', 'Bedroom with new floors and natural wood walls'),
('216-iselin-rd-cape-may-nj-backyard.jpg', 'Wide backyard lawn surrounded by trees')],
         blurb='A Cape May Cape Cod on a large wooded lot, shot with lot-line drone views.',
         intro=('216 Iselin Rd is a Cape Cod on a large, tree-lined lot in Cape May. The lot is a big part of the value, so the drone shots outline the '
 'property lines and show the land from above and toward the Delaware Bay. Inside, the shoot covered the knotty pine living room, the '
 'wood-paneled kitchen, an updated bathroom and a bedroom.'),
         highlights=['Front exterior on the big lawn',
'Drone views with the property lines outlined',
'Aerial toward the Delaware Bay',
'Knotty pine living room and wood-paneled kitchen',
'Updated bathroom, bedroom and the wide backyard'],
         tags=['Lot-line drone views', 'HDR interiors', 'Edited & MLS-ready']),
    dict(slug='3-blueberry-ln-s-cape-may-nj',
         address='3 Blueberry Ln S',
         town='Cape May',
         zip='08204',
         agent='Savannah McClintock',
         brokerage='',
         date='June 2024',
         photos=[('3-blueberry-ln-s-cape-may-nj-front-exterior.jpg', 'Ranch home with red shingle siding in Cape May NJ'),
('3-blueberry-ln-s-cape-may-nj-drone-front.jpg', 'Drone view of the Cape May NJ ranch, garden and driveway'),
('3-blueberry-ln-s-cape-may-nj-lot-line-drone.jpg', 'Top-down drone view with the property lines outlined'),
('3-blueberry-ln-s-cape-may-nj-wide-aerial.jpg', 'Wide drone aerial over the wooded Cape May NJ neighborhood'),
('3-blueberry-ln-s-cape-may-nj-living-room.jpg', 'Living room with pressed-tin style ceiling and wood-look floors'),
('3-blueberry-ln-s-cape-may-nj-wood-stove.jpg', 'Cast iron wood stove on a tile hearth'),
('3-blueberry-ln-s-cape-may-nj-kitchen.jpg', 'Kitchen with light wood cabinets and stainless appliances'),
('3-blueberry-ln-s-cape-may-nj-bathroom.jpg', 'Bathroom with glass walk-in shower'),
('3-blueberry-ln-s-cape-may-nj-bedroom.jpg', 'Bedroom with ceiling fan and double closet'),
('3-blueberry-ln-s-cape-may-nj-backyard.jpg', 'Back of the home with raised garden beds'),
('3-blueberry-ln-s-cape-may-nj-shed.jpg', 'Backyard with barn-style shed and mature trees')],
         blurb='A Cape May ranch with a wood stove, garden beds and lot-line drone views.',
         intro=('3 Blueberry Ln S is a ranch in a wooded Cape May neighborhood with a cast iron wood stove inside and raised garden beds out back. The '
 'shoot covered the living room, kitchen, bathroom and a bedroom, then used the drone for a lot-line view and a wide shot over the trees.'),
         highlights=['Front exterior and drone view of the home and garden',
'Top-down drone view with property lines',
'Living room and cast iron wood stove',
'Kitchen, bathroom with walk-in shower and bedroom',
'Raised garden beds and backyard shed'],
         tags=['Lot-line drone view', 'HDR interiors', 'Edited & MLS-ready']),
    dict(slug='707-adriatic-ave-north-cape-may-nj',
         address='707 Adriatic Ave',
         town='North Cape May',
         zip='08204',
         agent='Jason Ruffenach',
         brokerage='',
         date='June 2024',
         photos=[('707-adriatic-ave-north-cape-may-nj-front-exterior.jpg', 'Ranch home with red shutters in North Cape May NJ'),
('707-adriatic-ave-north-cape-may-nj-aerial-bay.jpg', 'Drone aerial over North Cape May NJ toward the Delaware Bay'),
('707-adriatic-ave-north-cape-may-nj-drone-front.jpg', 'Drone view of the North Cape May NJ ranch and fenced yard'),
('707-adriatic-ave-north-cape-may-nj-top-down-drone.jpg', 'Top-down drone view of the lot and shade trees'),
('707-adriatic-ave-north-cape-may-nj-living-room.jpg', 'Bright living room with ceiling light and big windows'),
('707-adriatic-ave-north-cape-may-nj-kitchen.jpg', 'Oak kitchen with stainless appliances and gas range'),
('707-adriatic-ave-north-cape-may-nj-dining-area.jpg', 'Open dining area connected to the kitchen'),
('707-adriatic-ave-north-cape-may-nj-bedroom.jpg', 'Bedroom with blue curtains and two windows'),
('707-adriatic-ave-north-cape-may-nj-back-deck.jpg', 'Back deck and large backyard'),
('707-adriatic-ave-north-cape-may-nj-shed.jpg', 'Red barn-style storage shed in the backyard')],
         blurb='A North Cape May ranch with a fenced yard, a back deck and aerials toward the bay.',
         intro=('This ranch on Adriatic Ave in North Cape May has red shutters, a fenced yard with shade trees, a back deck and a barn-style shed. The '
 'shoot covered the bright living room, the oak kitchen, the dining area and a bedroom, and the drone showed the home, the lot and the '
 'Delaware Bay a short distance away.'),
         highlights=['Front exterior with red shutters',
'Drone views of the home, lot and shade trees',
'Aerial over North Cape May toward the bay',
'Living room, kitchen and dining area',
'Back deck, backyard and red barn-style shed'],
         tags=['HDR interiors', 'Drone aerials', 'Outdoor living']),
    dict(slug='1622-jennings-ave-villas-nj',
         address='1622 Jennings Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='',
         date='June 2024',
         photos=[('1622-jennings-ave-villas-nj-front-exterior.jpg', 'Sage green bungalow with front porch in Villas NJ'),
('1622-jennings-ave-villas-nj-drone-front.jpg', 'Drone view of the Villas NJ bungalow and driveway'),
('1622-jennings-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the roofline and backyard'),
('1622-jennings-ave-villas-nj-living-room.jpg', 'Living room with fireplace and hardwood floors'),
('1622-jennings-ave-villas-nj-kitchen-dining.jpg', 'Eat-in kitchen with round table and chandelier'),
('1622-jennings-ave-villas-nj-kitchen.jpg', 'Butcher block counters and farmhouse sink'),
('1622-jennings-ave-villas-nj-bedroom.jpg', 'Blue bedroom with wood platform bed'),
('1622-jennings-ave-villas-nj-home-office.jpg', 'Home office with desk and big windows'),
('1622-jennings-ave-villas-nj-bathroom.jpg', 'Bathroom with green vanity and open shelving'),
('1622-jennings-ave-villas-nj-back-deck.jpg', 'Back deck with Adirondack chairs'),
('1622-jennings-ave-villas-nj-fire-pit.jpg', 'Fenced backyard with fire pit and deck'),
('1622-jennings-ave-villas-nj-detached-garage.jpg', 'Driveway leading to the detached garage')],
         blurb='A Villas bungalow with a butcher block kitchen, a fire pit and a detached garage.',
         intro=('1622 Jennings Ave is a sage green bungalow in Villas with a front porch, a fenced backyard and a detached garage at the end of the '
 'driveway. Inside, the shoot covered the living room with its fireplace, the eat-in kitchen with butcher block counters and a farmhouse '
 'sink, a bedroom, the home office and the bathroom. Out back it caught the deck and the fire pit.'),
         highlights=['Front exterior and drone views of the home',
'Living room with fireplace',
'Eat-in kitchen with butcher block counters',
'Bedroom, home office and bathroom',
'Back deck, fire pit and detached garage'],
         tags=['HDR interiors', 'Outdoor living', 'Drone aerials']),
    dict(slug='15-harmony-ln-north-cape-may-nj',
         address='15 Harmony Ln',
         town='North Cape May',
         zip='08204',
         agent='Jason Ruffenach',
         brokerage='',
         date='April 2024',
         photos=[('15-harmony-ln-north-cape-may-nj-front-exterior.jpg', 'Ranch home with green shutters and shade trees in North Cape May NJ'),
('15-harmony-ln-north-cape-may-nj-back-of-house.jpg', 'Back of the home with deck and big green lawn'),
('15-harmony-ln-north-cape-may-nj-top-down-drone.jpg', 'Top-down drone view of the North Cape May NJ lot'),
('15-harmony-ln-north-cape-may-nj-street-aerial.jpg', 'Drone aerial of the street and neighborhood in North Cape May NJ'),
('15-harmony-ln-north-cape-may-nj-living-room.jpg', 'Living room with sectional sofa and rattan pendant lights'),
('15-harmony-ln-north-cape-may-nj-dining-room.jpg', 'Dining room with hardwood floors and chandelier'),
('15-harmony-ln-north-cape-may-nj-bathroom.jpg', 'Updated bathroom with arched mirror and dark vanity'),
('15-harmony-ln-north-cape-may-nj-primary-bedroom.jpg', 'Primary bedroom with wood dresser and mini-split'),
('15-harmony-ln-north-cape-may-nj-bunk-room.jpg', 'Kids room with white bunk beds'),
('15-harmony-ln-north-cape-may-nj-back-deck.jpg', 'Back deck with outdoor lounge furniture'),
('15-harmony-ln-north-cape-may-nj-patio.jpg', 'Brick patio with picnic table and fenced yard')],
         blurb='A North Cape May ranch with an updated bath, a back deck and a fenced brick patio.',
         intro=('This ranch on Harmony Ln in North Cape May has green shutters, big shade trees and a fenced backyard with a deck and brick patio. The '
 "interiors cover the living room, dining room, an updated bathroom, the primary bedroom and a kids' room with bunk beds, and the drone "
 'shows the lot and the street from above.'),
         highlights=['Front exterior and the back of the home',
'Top-down and street drone aerials',
'Living room and dining room',
'Updated bathroom, primary bedroom and bunk room',
'Back deck and brick patio'],
         tags=['HDR interiors', 'Outdoor living', 'Drone aerials']),
    dict(slug='10-e-atlantic-ave-villas-nj',
         address='10 E Atlantic Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='',
         date='January 2024',
         photos=[('10-e-atlantic-ave-villas-nj-virtual-twilight.jpg', 'Villas NJ cottage with white deck under a virtual twilight sky'),
('10-e-atlantic-ave-villas-nj-front-exterior.jpg', 'Raised cottage with white lattice deck and front stairs in Villas NJ'),
('10-e-atlantic-ave-villas-nj-drone-aerial.jpg', 'Drone aerial of the Villas NJ cottage and neighborhood'),
('10-e-atlantic-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the lot and backyard'),
('10-e-atlantic-ave-villas-nj-living-room.jpg', 'Living room with ceiling fan and bright windows'),
('10-e-atlantic-ave-villas-nj-kitchen.jpg', 'Galley kitchen with oak cabinets and gas range'),
('10-e-atlantic-ave-villas-nj-dining-area.jpg', 'Dining area with sliding door to the deck'),
('10-e-atlantic-ave-villas-nj-bedroom.jpg', 'Bedroom with mirrored closet doors'),
('10-e-atlantic-ave-villas-nj-bathroom.jpg', 'Bathroom with coral walls and navy vanity'),
('10-e-atlantic-ave-villas-nj-back-deck.jpg', 'Back deck with sliding doors'),
('10-e-atlantic-ave-villas-nj-outdoor-shower.jpg', 'Outdoor shower with wood privacy fence'),
('10-e-atlantic-ave-villas-nj-shed.jpg', 'Backyard storage shed and paver patio')],
         blurb='A raised Villas cottage with a lattice deck, an outdoor shower and a virtual twilight.',
         intro=('This raised cottage on E Atlantic Ave in Villas has a white lattice deck across the front, an outdoor shower and a backyard shed. The '
 'lead photo is a virtual twilight that gives the exterior a warm evening glow, and the rest of the shoot covers the living room, galley '
 'kitchen, dining area, bedroom and bathroom, plus drone views of the lot.'),
         highlights=['Virtual twilight exterior',
'Front deck and stairs in daylight',
'Drone aerial and top-down lot view',
'Living room, galley kitchen, dining area, bedroom and bathroom',
'Back deck, outdoor shower and shed'],
         tags=['Virtual twilight', 'HDR interiors', 'Drone aerials']),
    dict(slug='2-walnut-ave-villas-nj',
         address='2 Walnut Ave',
         town='Villas',
         zip='08251',
         agent='Jason Ruffenach',
         brokerage='',
         date='January 2024',
         photos=[('2-walnut-ave-villas-nj-front-exterior.jpg', 'Ranch home with detached garage in Villas NJ'),
('2-walnut-ave-villas-nj-front-lawn.jpg', 'Ranch home with coral front door and solar panels in Villas NJ'),
('2-walnut-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the Villas NJ corner lot'),
('2-walnut-ave-villas-nj-drone-aerial.jpg', 'Drone aerial of the home, yard and detached garage'),
('2-walnut-ave-villas-nj-sunroom.jpg', 'Sunroom family room with sectional and coastal decor'),
('2-walnut-ave-villas-nj-kitchen.jpg', 'White kitchen with open wood shelving and gas range'),
('2-walnut-ave-villas-nj-butcher-block.jpg', 'Butcher block counter with farmhouse faucet'),
('2-walnut-ave-villas-nj-living-room.jpg', 'Living room with coral door and wall-mounted TV'),
('2-walnut-ave-villas-nj-bedroom.jpg', 'Bedroom with purple ombre accent wall'),
('2-walnut-ave-villas-nj-bathroom.jpg', 'Bathroom with round mirror and coastal wood-look tile'),
('2-walnut-ave-villas-nj-pergola.jpg', 'Backyard pergola with string lights and lounge chairs'),
('2-walnut-ave-villas-nj-sheds.jpg', 'Two storage sheds by the driveway')],
         blurb='A Villas ranch with a coastal sunroom, a pergola yard and a detached garage.',
         intro=('2 Walnut Ave is a ranch on a corner lot in Villas with a detached garage, solar panels and a backyard pergola strung with lights. The '
 'coastal styling inside photographs beautifully, from the sunroom family room to the white kitchen with open wood shelving and the '
 'bedroom with a purple ombre wall. The drone shows the whole corner lot from above.'),
         highlights=['Front exterior and the detached garage',
'Top-down and angled drone views of the corner lot',
'Sunroom family room and living room',
'White kitchen with butcher block and open shelving',
'Bedroom, bathroom, pergola and storage sheds'],
         tags=['HDR interiors', 'Drone aerials', 'Outdoor living']),
    dict(slug='225-e-garfield-ave-wildwood-nj',
         address='225 E Garfield Ave',
         town='Wildwood',
         zip='08260',
         agent='Jason Ruffenach',
         brokerage='',
         date='July 2023',
         photos=[('225-e-garfield-ave-wildwood-nj-front-exterior.jpg', 'Three-story Wildwood NJ shore house with wide front porch'),
('225-e-garfield-ave-wildwood-nj-front-porch.jpg', 'Covered front porch with wicker seating'),
('225-e-garfield-ave-wildwood-nj-living-room.jpg', 'Living room with tile floors and coastal blue walls'),
('225-e-garfield-ave-wildwood-nj-dining-room.jpg', 'Dining room beside a brick fireplace'),
('225-e-garfield-ave-wildwood-nj-kitchen.jpg', 'Kitchen with oak cabinets and long counters'),
('225-e-garfield-ave-wildwood-nj-bedroom.jpg', 'Blue bedroom with ceiling fan and coastal quilt'),
('225-e-garfield-ave-wildwood-nj-guest-bedroom.jpg', 'Bedroom with white dresser and beach decor'),
('225-e-garfield-ave-wildwood-nj-bathroom.jpg', 'Bathroom with tub and pedestal sink'),
('225-e-garfield-ave-wildwood-nj-back-patio.jpg', 'Back patio with colorful chairs and shade tree'),
('225-e-garfield-ave-wildwood-nj-rear-stairs.jpg', 'Rear stairs to the upper floors and courtyard')],
         blurb='A three-story Wildwood shore house with a big front porch and a back courtyard.',
         intro=('225 E Garfield Ave is a three-story shore house in Wildwood with a wide covered front porch and a back courtyard patio. The shoot '
 'covered the coastal living room, the dining room beside the brick fireplace, the kitchen, several bedrooms and a bathroom, plus the rear '
 'stairs and patio that make it a classic Wildwood summer house.'),
         highlights=['Front exterior and covered front porch',
'Living room and dining room by the brick fireplace',
'Kitchen with long counters',
'Bedrooms and bathroom',
'Back patio and rear stairs'],
         tags=['HDR interiors', 'Porch & patio', 'Edited & MLS-ready']),
    dict(slug='207-w-bennett-ave-wildwood-nj',
         address='207 W Bennett Ave',
         town='Wildwood',
         zip='08260',
         agent='',
         brokerage='',
         date='June 2023',
         photos=[('207-w-bennett-ave-wildwood-nj-front-exterior.jpg', 'New construction townhomes with three levels of balconies in Wildwood NJ'),
('207-w-bennett-ave-wildwood-nj-angle-exterior.jpg', 'Side angle of the new Wildwood NJ townhomes and garages'),
('207-w-bennett-ave-wildwood-nj-kitchen.jpg', 'White kitchen with quartz island, pendant lights and stainless appliances'),
('207-w-bennett-ave-wildwood-nj-living-room.jpg', 'Open living room with hardwood floors and kitchen island seating'),
('207-w-bennett-ave-wildwood-nj-virtually-staged-bedroom.jpg', 'Virtually staged bedroom with bed, rug and nightstand'),
('207-w-bennett-ave-wildwood-nj-bedroom-before-staging.jpg', 'The same bedroom before virtual staging'),
('207-w-bennett-ave-wildwood-nj-bathroom.jpg', 'Bathroom with backlit mirror and dark vanity'),
('207-w-bennett-ave-wildwood-nj-covered-balcony.jpg', 'Covered balcony with sliding glass doors'),
('207-w-bennett-ave-wildwood-nj-laundry-stairs.jpg', 'Stacked laundry and modern black stair railing'),
('207-w-bennett-ave-wildwood-nj-drone-aerial.jpg', 'Drone aerial of the townhomes at the corner in Wildwood NJ'),
('207-w-bennett-ave-wildwood-nj-aerial-ocean.jpg', 'Aerial over Wildwood NJ toward the beach and ocean'),
('207-w-bennett-ave-wildwood-nj-front-entry.jpg', 'Front entry door with house number 209')],
         blurb='New construction Wildwood townhomes with balconies, a quartz kitchen and virtual staging.',
         intro=('These new construction townhomes on W Bennett Ave in Wildwood have three levels of balconies, garages and modern interiors with hardwood '
 'floors, a white quartz kitchen and black stair railings. One bedroom was virtually staged, shown here next to the empty room so you can '
 'see the difference. Drone aerials show the corner location and the beach a short walk away.'),
         highlights=['Front and side exteriors of the new townhomes',
'White kitchen with quartz island and open living room',
'Virtually staged bedroom next to the empty original',
'Bathroom, covered balcony and stacked laundry',
'Drone aerials of the corner and toward the ocean'],
         tags=['New construction', 'Virtual staging', 'Drone aerials']),
    dict(slug='5-cedar-mill-ln-cape-may-court-house-nj',
         address='5 Cedar Mill Ln',
         town='Cape May Court House',
         zip='08210',
         agent='Jason Ruffenach',
         brokerage='',
         date='June 2023',
         photos=[('5-cedar-mill-ln-cape-may-court-house-nj-front-exterior.jpg', 'Long ranch home on a wide lawn in Cape May Court House NJ'),
('5-cedar-mill-ln-cape-may-court-house-nj-drone-aerial.jpg', 'Drone aerial of the ranch home and large lot'),
('5-cedar-mill-ln-cape-may-court-house-nj-top-down-drone.jpg', 'Top-down drone view of the Cape May Court House property'),
('5-cedar-mill-ln-cape-may-court-house-nj-wide-aerial.jpg', 'Wide aerial over woods and fields around the property'),
('5-cedar-mill-ln-cape-may-court-house-nj-kitchen.jpg', 'Large kitchen with maple cabinets, island and stainless appliances'),
('5-cedar-mill-ln-cape-may-court-house-nj-home-office.jpg', 'Built-in home office off the kitchen'),
('5-cedar-mill-ln-cape-may-court-house-nj-great-room.jpg', 'Great room with vaulted ceiling and sliding glass door'),
('5-cedar-mill-ln-cape-may-court-house-nj-family-room.jpg', 'Family room with sectional and big windows'),
('5-cedar-mill-ln-cape-may-court-house-nj-sunroom.jpg', 'Enclosed sunroom overlooking the backyard'),
('5-cedar-mill-ln-cape-may-court-house-nj-primary-bedroom.jpg', 'Primary bedroom with sitting area'),
('5-cedar-mill-ln-cape-may-court-house-nj-rear-exterior.jpg', 'Back of the home with sunroom and lawn'),
('5-cedar-mill-ln-cape-may-court-house-nj-shed.jpg', 'Backyard shed with shutters')],
         blurb='A long Cape May Court House ranch with a big kitchen, sunroom and wide-open lot.',
         intro=('This ranch on Cedar Mill Ln in Cape May Court House sits on a wide lawn surrounded by woods and fields. The large kitchen with its '
 'island and built-in office was a highlight, along with the vaulted great room, the family room and an enclosed sunroom. Drone aerials '
 'show the size of the lot and the open land around it.'),
         highlights=['Front exterior on the wide lawn',
'Drone aerial, top-down lot view and a wide shot over the fields',
'Kitchen with island and built-in home office',
'Great room, family room and sunroom',
'Primary bedroom, back of the home and shed'],
         tags=['HDR interiors', 'Drone aerials', 'Large lot']),
    dict(slug='14-thistle-ln-cape-may-nj',
         address='14 Thistle Ln',
         town='Cape May',
         zip='08204',
         agent='',
         brokerage='',
         date='May 2023',
         photos=[('14-thistle-ln-cape-may-nj-front-exterior.jpg', 'Ranch home with garage and manicured lawn in Cape May NJ'),
('14-thistle-ln-cape-may-nj-side-garden.jpg', 'Home with Japanese maple and landscaped beds'),
('14-thistle-ln-cape-may-nj-drone-front.jpg', 'Drone view of the home, paver driveway and trees'),
('14-thistle-ln-cape-may-nj-top-down-drone.jpg', 'Top-down drone view of the Cape May NJ lot'),
('14-thistle-ln-cape-may-nj-wide-aerial.jpg', 'Wide drone aerial over the wooded Cape May NJ neighborhood'),
('14-thistle-ln-cape-may-nj-kitchen.jpg', 'White kitchen with stainless appliances and recessed lighting'),
('14-thistle-ln-cape-may-nj-living-room.jpg', 'Vaulted living room with neutral decor'),
('14-thistle-ln-cape-may-nj-dining-area.jpg', 'Dining area with chandelier and French doors'),
('14-thistle-ln-cape-may-nj-primary-bedroom.jpg', 'Primary bedroom with soft neutral colors'),
('14-thistle-ln-cape-may-nj-bathroom.jpg', 'Bathroom with sage walls and white vanity'),
('14-thistle-ln-cape-may-nj-back-deck.jpg', 'Back deck with outdoor seating and umbrella'),
('14-thistle-ln-cape-may-nj-front-porch.jpg', 'Covered front porch with rocking chairs')],
         blurb='A Cape May ranch with a white kitchen, a vaulted living room and a shaded back deck.',
         intro=('14 Thistle Ln is a ranch in a wooded Cape May neighborhood with a covered front porch, a paver driveway and a Japanese maple out front. '
 'Inside, the shoot covered the white kitchen, the vaulted living room, the dining area, the primary bedroom and a bathroom, and the drone '
 'showed the lot and the tree cover around it.'),
         highlights=['Front exterior and landscaped side garden',
'Drone view, top-down lot view and wide aerial',
'White kitchen with stainless appliances',
'Vaulted living room and dining area',
'Primary bedroom, bathroom, back deck and front porch'],
         tags=['HDR interiors', 'Drone aerials', 'Outdoor living']),
    dict(slug='500-desoto-ave-villas-nj',
         address='500 Desoto Ave',
         town='Villas',
         zip='08251',
         agent='',
         brokerage='',
         date='May 2023',
         photos=[('500-desoto-ave-villas-nj-front-exterior.jpg', 'Gray cottage with front deck on a corner lot in Villas NJ'),
('500-desoto-ave-villas-nj-drone-front.jpg', 'Drone view of the Villas NJ cottage and fenced yard'),
('500-desoto-ave-villas-nj-top-down-drone.jpg', 'Top-down drone view of the lot, deck and garage'),
('500-desoto-ave-villas-nj-aerial-bay.jpg', 'Drone aerial over Villas NJ toward the Delaware Bay'),
('500-desoto-ave-villas-nj-open-living.jpg', 'Open living area flowing into the kitchen'),
('500-desoto-ave-villas-nj-kitchen.jpg', 'Oak kitchen with tile backsplash and white appliances'),
('500-desoto-ave-villas-nj-family-room.jpg', 'Bright room with French doors to the deck'),
('500-desoto-ave-villas-nj-bedroom.jpg', 'Bedroom with ceiling fan and two windows'),
('500-desoto-ave-villas-nj-bathroom.jpg', 'Bathroom with glass shower and wainscoting'),
('500-desoto-ave-villas-nj-back-deck.jpg', 'Large back deck with white railings'),
('500-desoto-ave-villas-nj-detached-garage.jpg', 'Detached garage in the backyard')],
         blurb='A Villas cottage on a corner lot with a big back deck and a detached garage.',
         intro=('500 Desoto Ave is a gray cottage on a fenced corner lot in Villas with a front deck, a large back deck and a detached garage. The shoot '
 'covered the open living area, the oak kitchen, a bright room with French doors, a bedroom and the bathroom, and the drone showed the lot '
 'from above and the Delaware Bay beyond the neighborhood.'),
         highlights=['Front exterior and drone view of the corner lot',
'Top-down drone view and aerial toward the bay',
'Open living area and kitchen',
'Room with French doors, bedroom and bathroom',
'Large back deck and detached garage'],
         tags=['HDR interiors', 'Drone aerials', 'Edited & MLS-ready']),
]

TOWNS = {'Buena': ('Buena in Atlantic County is a rural borough with roomy lots and family homes, a short drive from Vineland and Hammonton. Drone '
           'shots that show the whole backyard are especially useful here, where outdoor space is a big part of the appeal.',
           ['Vineland', 'Millville', 'Hammonton', 'Newfield', 'Franklinville']),
 'Cape May': ('Cape May is the southern tip of New Jersey and one of the most recognizable shore towns on the East Coast. Beyond the '
              'Victorian district, the Cape May area includes wooded neighborhoods with larger lots, where drone aerials and lot-line '
              'views help buyers understand exactly what they are getting.',
              ['North Cape May', 'Cape May Point', 'West Cape May', 'Villas', 'Wildwood Crest']),
 'Cape May Court House': ('Cape May Court House is the county seat in Middle Township, offering more land and newer neighborhoods than the '
                          'barrier islands while staying a short drive from the beaches. Larger lots, pools and townhome communities are '
                          'common here, and drone views are the best way to show the space.',
                          ['Swainton', 'Rio Grande', 'Wildwood', 'Stone Harbor', 'Dennisville']),
 'Millville': ('Millville in Cumberland County offers more house and more land for the money, from mid-century modern homes near Union '
               'Lake to Cape Cods with pools. Detailed interiors and drone aerials help these listings stand out to buyers browsing from '
               'across South Jersey.',
               ['Vineland', 'Buena', 'Bridgeton', 'Port Elizabeth', 'Woodbine']),
 'North Cape May': ('North Cape May sits in Lower Township between Cape May and the Delaware Bay, with blocks of ranches and cottages a '
                    'short walk or bike ride from the bay beaches. Buyers here often care about how close the beach is, so drone aerials '
                    'that show the route to the water and the size of the lot do a lot of the selling.',
                    ['Cape May', 'Villas', 'Cape May Point', 'Rio Grande', 'Wildwood Crest']),
 'North Wildwood': ('North Wildwood sits at the northern end of Five Mile Beach, with ocean blocks on one side and the back bay and '
                    'marshes on the other. From bayfront townhomes to commercial spaces on New Jersey Ave, North Wildwood properties '
                    'benefit from drone aerials that show the water and the location in town.',
                    ['Wildwood', 'Wildwood Crest', 'Stone Harbor', 'Cape May Court House', 'Avalon']),
 'Ocean View': ('Ocean View in Dennis Township is a wooded, quieter alternative to the shore towns, minutes from Sea Isle City and Ocean '
                'City. Homes here often sit on bigger lots with room for pools, decks and gardens, which is why we pair interior '
                'photography with lot-line drone views.',
                ['Sea Isle City', 'Marmora', 'Ocean City', 'Dennisville', 'Cape May Court House']),
 'Somers Point': ('Somers Point sits on Great Egg Harbor Bay just across the bridge from Ocean City, mixing waterfront neighborhoods with '
                  'classic suburban streets.',
                  ['Ocean City', 'Linwood', 'Egg Harbor Township', 'Marmora', 'Northfield']),
 'Villas': ('Villas is a bayside community in Lower Township on the Delaware Bay, known for its quiet residential streets, beach access '
            'along the bay and some of the best sunsets in Cape May County. Homes here range from classic shore cottages and ranches to '
            'renovated and new construction homes. Listing photos in Villas sell the lifestyle as much as the house, so we use drone '
            'aerials to show how close a home sits to the bay.',
            ['North Cape May', 'Cape May', 'Rio Grande', 'Cape May Court House', 'Wildwood']),
 'Vineland': ('Vineland is the largest city by area in New Jersey, with established neighborhoods of colonials and ranches on generous '
              'lots. Bright interiors and drone views of the yard and driveway give Vineland listings the polish buyers expect online.',
              ['Millville', 'Buena', 'Newfield', 'Bridgeton', 'Franklinville']),
 'Wildwood': ('Wildwood is famous for its boardwalk and wide free beaches, and its housing mix runs from classic shore houses to new '
              'construction townhomes and condos. Many Wildwood listings are second homes and rentals, so photos that show balconies, '
              'outdoor space and the distance to the beach make a real difference online.',
              ['North Wildwood', 'Wildwood Crest', 'West Wildwood', 'Cape May Court House', 'Rio Grande'])}

# Service Area map pins (data/jobs.json): one pin per property in
# tools/jobs.csv, the full job list from HD Photo Hub. Rows marked approx=1
# sit in the right town but not on the house; tools/geocode_jobs.py swaps in
# exact spots (and fills new rows) once the Census geocoder is reachable. A job with a blog post gets its
# photo and a link in the pin's popup.
def _addr_key(address, town):
    return "".join(ch for ch in f"{address}{town}".lower() if ch.isalnum())

def jobs_json():
    posts = {_addr_key(s["address"], s["town"]): s for s in SHOOTS}
    jobs = []
    with open(os.path.join(HERE, "tools", "jobs.csv"), newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if not (row["lat"] and row["lng"]):
                print(f"build_blog.py: no map pin for {row['address']}, {row['town']} -- run tools/geocode_jobs.py")
                continue
            job = {"address": row["address"], "town": row["town"],
                   "lat": float(row["lat"]), "lng": float(row["lng"])}
            if int(row["shoots"] or 1) > 1:
                job["shoots"] = int(row["shoots"])
            post = posts.get(_addr_key(row["address"], row["town"]))
            if post:
                job["url"] = f"blog/{post['slug']}.html"
                job["thumb"] = f"images/{post['photos'][0][0][:-4]}-480.jpg"
            jobs.append(job)
    return {"jobs": jobs, "count": len(jobs)}

DEFAULT_SERVICES_NOTE = ("HDR listing photography with professional editing and color correction, "
                         "delivered next-day and sized ready for the MLS. Drone aerial photography showed "
                         "the lot, the setting, and the surrounding {town} neighborhood \u2014 the views "
                         "that make South Jersey listings stand out online.")

def a_an(word):
    return "an" if word[:1].lower() in "aeiou" else "a"

NAV = """  <header class="site-header">
    <nav class="nav" aria-label="Main navigation">
      <a class="brand" href="../index.html" aria-label="Listing Pixl home"><img src="../images/logo-horizontal-156.jpg" srcset="../images/logo-horizontal-156.jpg 1x, ../images/logo-horizontal-312.jpg 2x" alt="Listing Pixl" class="brand-logo" width="156" height="66"></a>
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false">&#9776;</button>
      <ul class="nav-links">
        <li><a href="../index.html#services">Services</a></li>
        <li><a href="../index.html#packages">Packages</a></li>
        <li><a href="../index.html#portfolio">Portfolio</a></li>
        <li><a href="../index.html#areas">Service Area</a></li>
        <li><a href="index.html">Blog</a></li>
        <li><a href="https://listingpixl.hd.pics/" target="_blank" rel="noopener">Client Login</a></li>
        <li><a href="../index.html#contact" class="nav-cta btn-pink">Lock In Your Shoot</a></li>
      </ul>
    </nav>
  </header>"""

FOOTER = f"""  <nav class="mobile-cta" aria-label="Quick contact">
    <a href="tel:+16097807027">Call</a>
    <a href="sms:+16097807027">Text</a>
    <a href="../index.html#contact" class="is-pink">Book a shoot</a>
  </nav>

  <footer class="site-footer">
    <div class="wrap">
      <p class="footer-contact">Call or text <a href="tel:+16097807027">{PHONE}</a> &middot; <a href="mailto:{EMAIL}">{EMAIL}</a></p>
      <p>Real estate photography across Cape May County &amp; South Jersey</p>
      <p>&copy; 2026 Listing Pixl. All rights reserved.</p>
      <p><a href="../privacy.html">Privacy Policy</a> &middot; <a href="{FB}" target="_blank" rel="noopener">Find us on Facebook</a></p>
    </div>
  </footer>

  <script src="../site.js" defer></script>"""

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
    print("WARNING: Pillow not installed — image sizes and resized copies will be skipped. pip install Pillow")

def img_size(fname):
    if not HAS_PILLOW:
        return ""
    try:
        w, h = Image.open(os.path.join(IMAGES, fname)).size
        return f' width="{w}" height="{h}"'
    except Exception:
        return ""

def srcset(fname, prefix="../images/", sizes="(max-width: 720px) 100vw, 720px"):
    """srcset attribute for 480/800/1200 copies when they exist."""
    import os
    base, ext = os.path.splitext(fname)
    parts = []
    for w in (480, 800, 1200):
        f = f"{base}-{w}{ext}"
        if os.path.exists(os.path.join(IMAGES, f)):
            parts.append(f"{prefix}{f} {w}w")
    if not parts:
        return ""
    full = 1600
    if HAS_PILLOW:
        try:
            full = Image.open(os.path.join(IMAGES, fname)).size[0]
        except Exception:
            pass
    parts.append(f"{prefix}{fname} {full}w")
    return ' srcset="' + ", ".join(parts) + f'" sizes="{sizes}"'

def post_page(s):
    title = f"{s['address']}, {s['town']} NJ Real Estate Photos | Listing Pixl"
    if len(title) > 62:  # Google truncates around 60 characters; drop the brand suffix on long addresses
        title = f"{s['address']}, {s['town']} NJ Real Estate Photos"
    desc = s.get("desc") or f"{s['address']}, {s['town']} NJ real estate photography by Listing Pixl. {s['blurb']}"
    if len(desc) > 158:
        desc = desc[:155].rsplit(" ", 1)[0] + "..."
    services = s.get("services_note") or DEFAULT_SERVICES_NOTE.format(town=html.escape(s['town']))
    def _img(i, p, a):
        first = (i == 0)
        load = 'loading="eager" fetchpriority="high"' if first else 'loading="lazy"'
        return (f'        <figure class="blog-photo">\n'
                f'          <a class="blog-photo-link" href="../images/{p}">'
                f'<img src="../images/{p}"{srcset(p)} alt="{html.escape(a)}" '
                f'{load}{img_size(p)}></a>\n'
                f'        </figure>')
    imgs = "\n".join(_img(i, p, a) for i, (p, a) in enumerate(s["photos"]))
    town_text, nearby = TOWNS.get(s["town"], ("", ["Wildwood", "Ocean City", "Stone Harbor", "Avalon", "Sea Isle City"]))
    area_list = ", ".join(nearby)
    cta = (f"Selling in {html.escape(s['town'])} or anywhere in Cape May County? Listing Pixl shoots across "
           f"{html.escape(s['town'])}, {area_list}, and surrounding South Jersey towns. Packages from $295. "
           f'Call or text <a href="tel:+16097807027">{PHONE}</a> or <a href="../index.html#contact">lock in your shoot online</a>.')
    schema = {"@context": "https://schema.org", "@type": "BlogPosting",
              "headline": f"Real Estate Photography in {s['town']}, NJ: {s['address']}",
              "image": [f"{DOMAIN}/images/{p}" for p, _ in s["photos"]],
              "author": {"@type": "Organization", "name": "Listing Pixl", "telephone": PHONE},
              "publisher": {"@type": "Organization", "name": "Listing Pixl",
                            "logo": {"@type": "ImageObject", "url": f"{DOMAIN}/listing-pixl-logo-official.png"}},
              "mainEntityOfPage": f"{DOMAIN}/blog/{s['slug']}.html",
              "about": f"Real estate photography in {s['town']}, New Jersey",
              "contentLocation": {"@type": "Place", "address": {"@type": "PostalAddress",
                                  "streetAddress": s["address"], "addressLocality": s["town"],
                                  "addressRegion": "NJ", "postalCode": s["zip"], "addressCountry": "US"}}}
    if s.get("agent"):
        by = f"{s['agent']}, {s['brokerage']}" if s.get("brokerage") else s["agent"]
        meta = f"Shot {html.escape(s['date'])} &middot; Listing agent: {html.escape(by)}"
        booked = (f" The shoot was booked by {html.escape(s['agent'])}"
                  + (f" of {html.escape(s['brokerage'])}" if s.get("brokerage") else "")
                  + " to give the listing scroll-stopping photos for the MLS, Zillow, and social media.")
    else:
        meta = f"Shot {html.escape(s['date'])}"
        booked = " The photos were edited and delivered ready for the MLS, Zillow, and social media."
    intro = f"\n        <p>{html.escape(s['intro'])}</p>" if s.get("intro") else ""
    highlights = ""
    if s.get("highlights"):
        items = "\n".join(f"          <li>{html.escape(h)}</li>" for h in s["highlights"])
        highlights = f"""
        <h2>What we photographed</h2>
        <ul class="post-highlights">
{items}
        </ul>
"""
    town_section = ""
    if town_text:
        town_section = f"""
        <h2>Real estate photography in {html.escape(s['town'])}, NJ</h2>
        <p>{html.escape(town_text)}</p>
"""
    related = [r for r in SHOOTS if r["slug"] != s["slug"] and r["town"] == s["town"]][:4]
    if len(related) < 4:
        related += [r for r in SHOOTS if r["slug"] != s["slug"] and r["town"] in nearby and r not in related][:4 - len(related)]
    related_html = ""
    if related:
        links = "\n".join(f'          <li><a href="{r["slug"]}.html">{html.escape(r["address"])}, {html.escape(r["town"])} NJ</a> &mdash; {html.escape(r["blurb"])}</li>' for r in related)
        related_html = f"""
        <h2>More shoots near {html.escape(s['town'])}</h2>
        <ul class="post-related">
{links}
        </ul>
"""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>document.documentElement.classList.add('js')</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta property="og:type" content="article">
  <link rel="canonical" href="{DOMAIN}/blog/{s['slug']}.html">
  <meta property="og:url" content="{DOMAIN}/blog/{s['slug']}.html">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:image" content="{DOMAIN}/images/{s['photos'][0][0]}">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="stylesheet" href="../styles.css">
  <script type="application/ld+json">
  {json.dumps(schema, indent=2)}
  </script>
{PIXEL_SNIPPET}
{GA_SNIPPET}
</head>
<body>
{NAV}

  <main>
    <article class="section">
      <div class="wrap narrow">
        <p class="blog-crumb"><a href="index.html">&larr; All shoots</a></p>
        <h1>Real Estate Photography in {html.escape(s['town'])}, NJ: {html.escape(s['address'])}</h1>
        <p class="blog-meta">{meta}</p>

        <h2>About this {html.escape(s['town'])} listing shoot</h2>
        <p>Listing Pixl provided professional real estate photography for this {html.escape(s['town'])}, New Jersey property at {html.escape(s['address'])} {html.escape(s['zip'])}. {html.escape(s['blurb'])}{booked}</p>{intro}

        <div class="blog-gallery">
{imgs}
        </div>
{highlights}
        <h2>Real estate photography services delivered</h2>
        <p>This {html.escape(s['town'])} NJ shoot included {services}</p>
{town_section}{related_html}
        <h2>Lock In {a_an(s['town'])} {html.escape(s['town'])}, NJ Real Estate Photographer</h2>
        <p>{cta}</p>
        <p class="post-cta"><a class="btn btn-pink" href="../index.html#contact">Lock In Your Shoot</a> <a class="btn btn-outline" href="index.html">See more shoots</a></p>
      </div>
    </article>
  </main>

{FOOTER}
</body>
</html>
"""

def index_page():
    cards = "\n".join(
        f"""        <article class="blog-card">
          <a href="{s['slug']}.html">
            <img src="../images/{s['photos'][0][0]}"{srcset(s['photos'][0][0])} alt="{html.escape(s['photos'][0][1])}" loading="lazy"{img_size(s['photos'][0][0])}>
            <h2>{html.escape(s['address'])} &mdash; {html.escape(s['town'])}, NJ</h2>
          </a>
          <p>{html.escape(s['blurb'])}</p>
          <p class="blog-meta">{html.escape(s['date'])}{(" &middot; " + html.escape(s['agent'])) if s.get('agent') else ""}</p>
        </article>""" for s in SHOOTS)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>document.documentElement.classList.add('js')</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recent Shoots | Listing Pixl South Jersey Real Estate Photography</title>
  <meta name="description" content="Recent real estate photography shoots by Listing Pixl across Cape May County & South Jersey NJ.">
  <meta property="og:type" content="website">
  <link rel="canonical" href="{DOMAIN}/blog/">
  <meta property="og:url" content="{DOMAIN}/blog/">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="{DOMAIN}/images/riogrande_01_twilight.jpg">
  <meta property="og:title" content="Recent Shoots | Listing Pixl">
  <meta property="og:description" content="Recent listing shoots across Cape May County & South Jersey NJ.">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="stylesheet" href="../styles.css">
{PIXEL_SNIPPET}
{GA_SNIPPET}
</head>
<body>
{NAV}

  <main>
    <section class="section">
      <div class="wrap">
        <h1>Recent Shoots: Real Estate Photography Across South Jersey</h1>
        <p class="section-lede">Every listing we shoot in Cape May County and South Jersey NJ &mdash; HDR photography, drone aerials, and virtual twilights for local listing agents.</p>
        <div class="blog-grid">
{cards}
        </div>
        <div class="work-cta">
          <p>Want your listing to look like this?</p>
          <a href="../index.html#contact" class="btn btn-pink">Lock In Your Shoot</a>
        </div>
      </div>
    </section>
  </main>

{FOOTER}
</body>
</html>
"""

# Homepage featured-shoot slider: one slide per post, rebuilt between the
# FEATURED markers in index.html so new posts show up automatically.
def featured_slides():
    slides = []
    n = len(SHOOTS)
    for i, s in enumerate(SHOOTS):
        p, alt = s["photos"][0]
        tags = "".join(f"<li>{html.escape(t)}</li>" for t in s.get("tags", []))
        tags_html = f'\n                <ul class="work-tags">{tags}</ul>' if tags else ""
        if s.get("agent"):
            by = f"{s['agent']}, {s['brokerage']}" if s.get("brokerage") else s["agent"]
            agent_html = f'\n                <p class="work-agent">Listed by {html.escape(by)}</p>'
        else:
            agent_html = ""
        srcset_attr = srcset(p, "images/", "(max-width: 720px) 100vw, 640px")
        slides.append(f"""            <div class="work-feature" role="group" aria-roledescription="slide" aria-label="{i + 1} of {n}">
              <a class="work-feature-media" href="blog/{s['slug']}.html" tabindex="-1" aria-hidden="true">
                <img src="images/{p}"{srcset_attr} alt="{html.escape(alt)}" loading="lazy"{img_size(p)}>
              </a>
              <div class="work-feature-body">
                <p class="work-eyebrow">{html.escape(s['town'])}, NJ &middot; {html.escape(s['date'])}</p>
                <h3>{html.escape(s['address'])}, {html.escape(s['town'])}</h3>
                <p>{html.escape(s['blurb'])}</p>{tags_html}{agent_html}
                <a class="btn btn-outline" href="blog/{s['slug']}.html">See the full shoot &rarr;</a>
              </div>
            </div>""")
    return "\n".join(slides), n

def update_homepage():
    path = os.path.join(HERE, "index.html")
    page = open(path, encoding="utf-8").read()
    slides, n = featured_slides()
    start, end = "<!-- FEATURED:START -->", "<!-- FEATURED:END -->"
    a, b = page.index(start) + len(start), page.index(end)
    page = page[:a] + "\n" + slides + "\n            " + page[b:]
    page = re.sub(r'<p class="fc-count"[^>]*>.*?</p>', f'<p class="fc-count" aria-live="polite"><span class="fc-now">1</span> / {n}</p>', page)
    open(path, "w", encoding="utf-8").write(page)

for s in SHOOTS:
    open(os.path.join(BLOG, s["slug"] + ".html"), "w", encoding="utf-8").write(post_page(s))
update_homepage()
open(os.path.join(BLOG, "index.html"), "w", encoding="utf-8").write(index_page())
os.makedirs(os.path.join(HERE, "data"), exist_ok=True)
with open(os.path.join(HERE, "data", "jobs.json"), "w", encoding="utf-8") as fh:
    json.dump(jobs_json(), fh, indent=1)
urls = ["/", "/blog/", "/privacy.html"] + [f"/blog/{s['slug']}.html" for s in SHOOTS]
with open(os.path.join(HERE, "sitemap.xml"), "w", encoding="utf-8") as fh:
    fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    fh.writelines(f"  <url>\n    <loc>{DOMAIN}{u}</loc>\n  </url>\n" for u in urls)
    fh.write("</urlset>\n")
# remove the deleted post if it exists
stale = os.path.join(BLOG, "301-e-pacific-ave-villas-nj.html")
if os.path.exists(stale):
    os.remove(stale)
    print("removed stale 301-e-pacific-ave post")
print(f"Wrote {len(SHOOTS)} posts + index to {BLOG}")
