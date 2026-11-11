export type Profile = {
    id: string;
    name: string;
    avatar: string;
    isKids?: boolean;
};

export const profiles: Profile[] = [
    {
        id: "alex",
        name: "Alex",
        avatar: "https://images.pexels.com/photos/30217126/pexels-photo-30217126.jpeg?auto=compress&cs=tinysrgb&w=300",
    },
    {
        id: "jordan",
        name: "Jordan",
        avatar: "https://images.pexels.com/photos/27132413/pexels-photo-27132413.jpeg?auto=compress&cs=tinysrgb&w=300",
    },
    {
        id: "sam",
        name: "Sam",
        avatar: "https://images.pexels.com/photos/35964819/pexels-photo-35964819.jpeg?auto=compress&cs=tinysrgb&w=300",
    },
    {
        id: "kids",
        name: "Kids",
        avatar: "https://images.pexels.com/photos/11142423/pexels-photo-11142423.jpeg?auto=compress&cs=tinysrgb&w=300",
        isKids: true,
    },
];

export function getProfileById(id: string): Profile | undefined {
    return profiles.find((p) => p.id === id);
}
