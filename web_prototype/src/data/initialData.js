export const INITIAL_PARTNERS = [
    { id: 'american_team', name: "🇺🇸 American Team (Logistics)", type: "Logistics" },
    { id: 'new_life', name: "New Life Ministries", type: "Local Ministry", programs: ["Training", "Malnutrition"] },
    { id: 'cross_healing', name: "Cross Healing Ministries", type: "Local Ministry", programs: ["Training"] },
    { id: 'passion', name: "Passion Christian Ministry", type: "Local Ministry", programs: ["Sponsor A Child", "High School"] },
    { id: 'hope_shine', name: "Hope Shine Uganda", type: "Local Ministry", programs: ["Night Life Workers", "Feeding"] },
    { id: 'medical', name: "Medical Team (Lamwo)", type: "Medical", programs: ["Medical"] }
];

export const INITIAL_TRIPS = [
    { id: 'june2025', name: 'June 2025 (Jinja/Kamuli)', status: 'Active' },
    { id: 'nov2025', name: 'Nov 2025 (Gulu)', status: 'Planning' }
];

export const INITIAL_ITEMS = [
    { id: 1, name: "Meat (1 Bull ~120kg)", unit: "Bull", defaultCost: 1500000 },
    { id: 2, name: "Posho (Maize Flour)", unit: "Sacks", defaultCost: 120000 },
    { id: 3, name: "Rice (Super)", unit: "Kg", defaultCost: 4500 },
    { id: 4, name: "Bic Pens", unit: "Box of 50", defaultCost: 25000 },
    { id: 5, name: "Bus Rental (Coaster)", unit: "Days", defaultCost: 450000 },
    { id: 6, name: "Hotel Room", unit: "Night", defaultCost: 150000 },
    { id: 901, desc: "Venue Rental / Contribution", unit: "Lumpsum", defaultCost: 200000 },
    { id: 902, desc: "Refreshments (Water/Soda)", unit: "Crates", defaultCost: 25000 },
    { id: 903, desc: "Lunch for Attendees", unit: "Plates", defaultCost: 5000 }
];

export const INITIAL_IMPACT_STATS = {
    medicalOutreach: [
        { id: 1, location: "Lamwo", count: 450, date: "2025-06-12", tripId: 'june2025' },
        { id: 2, location: "Jinja", count: 320, date: "2025-06-15", tripId: 'june2025' },
        { id: 3, location: "Village of Hope", count: 180, date: "2025-06-18", tripId: 'june2025' },
    ]
};

export const MOCK_TRIPS_HISTORICAL = [
    { id: 'june2024', name: 'June 2024 (Kampala)', total: 15000000, breakdown: { Training: 5000000, Medical: 7000000, Logistics: 3000000 }, currency: 'UGX' },
    { id: 'june2025', name: 'June 2025 (Jinja)', total: 18500000, breakdown: { Training: 6000000, Medical: 8500000, Logistics: 4000000 }, currency: 'UGX' },
    { id: 'nov2025', name: 'Nov 2025 (Gulu) [Projected]', total: 21000000, breakdown: { Training: 7000000, Medical: 10000000, Logistics: 4000000 }, currency: 'UGX' }
];

export const MOCK_PASTORS = [
    { id: 1, name: "Rev. Simon Peter", district: "Jinja", partner: "New Life Ministries", phone: "+256 772 123456", email: "simon@newlife.org", nin: "CM9001...", tripId: 'june2025' },
    { id: 2, name: "Pst. Mary Grace", district: "Lamwo", partner: "Cross Healing Ministries", phone: "+256 701 987654", email: "mary@crosshealing.org", nin: "CF8002...", tripId: 'june2025' },
    { id: 3, name: "Bishop John Okello", district: "Gulu", partner: "Passion Christian Ministry", phone: "+256 753 555666", email: "john@pcm.ug", nin: "CM7003...", tripId: 'nov2025' },
    { id: 4, name: "Pst. David Mukasa", district: "Kampala", partner: "New Life Ministries", phone: "+256 782 111222", email: "david@newlife.org", nin: "CM6004...", tripId: 'june2025' },
];

export const UGX_RATE = 3700;
