const musicPlatforms = {
    amazonMusic: "Amazon Music",
    amazonStore: "Amazon Appstore",
    anghami: "Anghami",
    appleMusic: "Apple Music",
    audiomack: "Audiomack",
    audius: "Audius",
    boomplay: "Boomplay",
    deezer: "Deezer",
    itunes: "iTunes",
    napster: "Napster",
    pandora: "Pandora",
    soundcloud: "SoundCloud",
    spinrilla: "Spinrilla",
    tidal: "Tidal",
    yandex: "Yandex Music",
    youtube: "YouTube",
    youtubeMusic: "YouTube Music"
};

var subMenu
var fetchedPlatformLinks = {}

function createNewSetting(platform: string) {
    const menuItem = new Spicetify.Menu.Item(
        `Show ${musicPlatforms[platform]} option`,
        Spicetify.LocalStorage.get(`odesli-${platform}`) == 'true' ? true : false,
        (menu) => { 
            menu.setState(!menu.isEnabled)
            Spicetify.LocalStorage.set(`odesli-${platform}`, menu.isEnabled)
            subMenu.deregister()
            subMenu = generateSubMenu(generatePlatformList())
            subMenu.register()
        }
    );
    return menuItem
}

function get_platform_link(spotify_link: any) {
    async function get_location() { // Get user's country code to access region specific links
        const response = await fetch('https://ipinfo.io/json');
        const data = await response.json();
        return data.country;
    }

    return new Promise(async (resolve, reject) => {
        try {
            const country_code = await get_location();
            const songlinks_url = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(spotify_link)}&userCountry=${country_code}`;
            const finalUrl = `https://cors-proxy.spicetify.app/${songlinks_url}`
            const response = await fetch(finalUrl);
            const data = await response.json();
            resolve(data.linksByPlatform);
        } catch (error) {
            reject(error);
        }
    });
}

function ifItemIsSupported(uri: string[]) {
    let uriObj = Spicetify.URI.fromString(uri[0]);
    switch (uriObj.type) {
        case "track":
            return true;
        case "album":
            return true;
    }
    return false;
  }

function fetchPlatformLinks(uri: any[]) {
    get_platform_link(uri[0])
    .then(async platformLinks =>{
        fetchedPlatformLinks[uri[0]] = platformLinks
    })
    .catch(error => console.error('Error:', error));
}

async function copyPlatformLinks(uri: any[], platform: string) {
    var platformLink

    async function copyLink(platformLink) {
        if (platformLink) {
            await Spicetify.Platform.ClipboardAPI.copy(platformLink);
            Spicetify.showNotification(`${musicPlatforms[platform]} link copied to the clipboard`);
        } else {
            Spicetify.showNotification(`${musicPlatforms[platform]} link is unavailable`);
        }
    }

    if (fetchedPlatformLinks && uri[0] in fetchedPlatformLinks) {
        if (platform in fetchedPlatformLinks[uri[0]]) {
            platformLink = fetchedPlatformLinks[uri[0]][platform].url;
        } else {
            platformLink =  null
        }
        copyLink(platformLink)
    } else {
        Spicetify.showNotification(`Searching for ${musicPlatforms[platform]} link, please wait...`);
        get_platform_link(uri[0])
        .then(async platformLinks => {
            if (platform in platformLinks) {
                fetchedPlatformLinks[uri[0]] = platformLinks
                platformLink = platformLinks[platform].url
            } else {
                platformLink =  null
            }
            copyLink(platformLink)
        })
        .catch(error => console.error('Error:', error));
    }
}

function createNewMenu(platform: string) {
    const menuItem = new Spicetify.ContextMenu.Item(
        `Copy ${musicPlatforms[platform]} link`,
        (uri) => copyPlatformLinks(uri, platform),
        () => true,
        Spicetify.SVGIcons["copy"],
        false,
    );
    return menuItem
}

function generateSubMenu(menus: Iterable<Spicetify.ContextMenu.Item>) {
    // Create a new sub menu
    const subMenu = new Spicetify.ContextMenu.SubMenu(
        "Odesli",
        menus,
        ifItemIsSupported,
        false,
    );
    return subMenu
}

function generateUserMenu(menus: Iterable<Spicetify.Menu.Item>) {
    // Create a new sub menu
    const subMenu = new Spicetify.Menu.SubMenu(
        "Odesli settings",
        menus,
    );
    return subMenu
}

function generatePlatformList() {
    var menus = []
    for (let platform in musicPlatforms) {
        if (Spicetify.LocalStorage.get(`odesli-${platform}`) == 'true' ? true : false) {
            menus.push(createNewMenu(platform))
        }
    }
    return menus
}

function createEventHandler() {
    // Register a listener that will be called when player changes track
    Spicetify.Player.addEventListener("songchange", (event) => {
        if (Spicetify.LocalStorage.get(`odesli-autoFetch`) == 'true' ? true : false) {
            fetchPlatformLinks([event?.data.item.uri])
        }
    });
}

function init_fetch() {
    if (Spicetify.LocalStorage.get(`odesli-autoFetch`) == 'true' ? true : false) {
        fetchPlatformLinks([Spicetify.Player.data?.item.uri])
    }
}

async function main() {
    while (!Spicetify?.showNotification) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    createEventHandler()
    const settings = []
    const autoFetchSetting = new Spicetify.Menu.Item(
        `Automatically fetch links on song change`,
        Spicetify.LocalStorage.get(`odesli-autoFetch`) == 'true' ? true : false,
        (menu) => { 
            menu.setState(!menu.isEnabled)
            Spicetify.LocalStorage.set(`odesli-autoFetch`, menu.isEnabled)
        }
    );
    settings.push(autoFetchSetting)
    // Iterate through all music platforms
    for (let platform in musicPlatforms) {
        settings.push(createNewSetting(platform))
    }
    subMenu = generateSubMenu(generatePlatformList());
    subMenu.register();
    generateUserMenu(settings).register();
    while (!Spicetify.Player.data) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    init_fetch()
}

export default main;
