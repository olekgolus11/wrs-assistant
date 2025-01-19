import { STATUS_CODE } from "jsr:@oak/commons@1/status";
import UniversityScraper from "../../services/UniversityScraper.ts";
import { Context } from "jsr:@oak/oak";
import type { ScrapedArticle } from "../../types/index.ts";

export const scrapeUniversityUrls = async (ctx: Context) => {
    const universityScraper = new UniversityScraper();
    const { url } = await ctx.request.body.json();
    const urls = await universityScraper.getUrlsFromSitemap(url);
    urls.forEach((url) => {
        console.log(url.url);
    });
    urls.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const scrapedArticles: ScrapedArticle[] = [];
    const concurrencyLimit = 10;
    const queue = urls.slice();
    const promises: Promise<void>[] = [];

    const worker = async () => {
        while (queue.length > 0) {
            const url = queue.shift();
            if (url) {
                let retries = 2;
                while (retries >= 0) {
                    try {
                        const article = await universityScraper.scrapeUrl(url);
                        scrapedArticles.push(article);
                        break; // Exit the retry loop if successful
                    } catch (error) {
                        console.error(error);
                        retries -= 1;
                        if (retries < 0) {
                            console.error(
                                `Failed to scrape ${url} after multiple attempts`,
                            );
                        }
                    }
                }
            }
        }
    };

    for (let i = 0; i < concurrencyLimit; i++) {
        promises.push(worker());
    }

    await Promise.all(promises);
    await universityScraper.addArticlesToVectorDB(scrapedArticles);
    ctx.response.body = scrapedArticles;
    ctx.response.status = STATUS_CODE.OK;
};

export const scrapeSavoirVivre = async (ctx: Context) => {
    const universityScraper = new UniversityScraper();
    const savoirVivreDocuments: ScrapedArticle[] = [
        {
            "title": "Savoir vivre czyli… Vademecum behawioralne studenta",
            "description":
                "Przewodnik dla studentów dotyczący zasad kultury i etykiety akademickiej. Zawiera wskazówki, jak komunikować się z wykładowcami oraz pracownikami uczelni.",
            "textContent":
                "Savoir vivre czyli… Vademecum behawioralne studenta\nDoskonale pamiętamy nasze pierwsze kroki na uczelni, nowe zasady i częste zachodzenie w głowę, jak zwrócić się do danego wykładowcy. W związku z tym, jako starsi koledzy wychodzimy Wam naprzeciw. W Wasze ręce oddajemy krótkie, ale bardzo treściwe Vademecum kultury studenta, które powinno być podstawą w komunikacji z pracownikami naszej uczelni.\nJeżeli uważacie, że ilość informacji tutaj zawartych jest niewystarczająca, macie pytania lub zauważyliście błędy, prosimy o kontakt na adres: eeia@samorzad.p.lodz.pl\nŻyczymy owocnej lektury :)",
            "keywords": [
                "savoir vivre",
                "etykieta akademicka",
                "komunikacja",
                "student",
                "uczelnia",
                "kultura",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Vademecum kultury studenta: Korespondencja",
            "description":
                "Zasady dotyczące korespondencji e-mailowej z wykładowcami i pracownikami uczelni.",
            "textContent":
                "Często prowadzący podają swój telefon albo adres e-mail, aby w razie potrzeby skontaktować się z nimi; nie powinniście pisać e-maili z błahymi problemami, a sprawy grupowe powinien załatwiać starosta grupy czy roku.\n\nNie zaczynamy e-maili do wykładowcy od zwrotu „Witam” lub „Witaj”; jest on zarezerwowany dla osoby o niższym statusie (analogicznie do poczty tradycyjnej). Można zacząć od formy „Dzień dobry”.\n\nNie piszemy z adresów e-mailowych kończących się na @buziaczek.pl, @ploteczka.pl itp. Posługujemy się kontami @edu.p.lodz.pl.",
            "keywords": [
                "korespondencja",
                "e-mail",
                "zasady",
                "student",
                "wykładowca",
                "kultura",
                "uczelnia",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Zasady grzecznościowe w korespondencji akademickiej",
            "description":
                "Podstawowe zasady dotyczące form grzecznościowych i rozpoczynania e-maili w środowisku akademickim",
            "textContent":
                "W e-mailach używamy form grzecznościowych np.: 'Szanowny Pan Profesor', 'Szanowna Pani Doktor', 'Szanowny Pan Magister'. Niedopuszczalne jest rozpoczynanie e-maila od 'Cześć' lub 'Witam' - taką formę możecie przyjąć pisząc do organizacji studenckich np.: do Samorządu Studenckiego lub do Koła Naukowego.",
            "keywords": [
                "etykieta",
                "e-mail",
                "formy grzecznościowe",
                "korespondencja akademicka",
                "zwroty formalne",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Wymogi formalne korespondencji studenckiej",
            "description":
                "Zasady dotyczące podpisywania e-maili i dodawania informacji identyfikacyjnych",
            "textContent":
                "Każdy e-mail podpisujemy imieniem i nazwiskiem oraz rokiem i kierunkiem studiów (warto dopisać też numer indeksu). W nagłówku e-maila wpisujemy krótką informację dotyczącą treści przesyłanej wiadomości i nazwę oraz termin zajęć.",
            "keywords": [
                "podpis e-mail",
                "dane studenta",
                "identyfikacja",
                "temat wiadomości",
                "korespondencja studencka",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Styl i forma korespondencji akademickiej",
            "description":
                "Wytyczne dotyczące stylu pisania, adresowania i poprawności językowej w e-mailach akademickich",
            "textContent":
                "E-maile powinny być krótkie i konkretne. Rozpisywanie się w e-mailu jest niewskazane (chyba, że jest to konieczne ze względu na specyfikę sprawy jaką macie do wykładowcy). Jeśli piszecie na e-mail ogólny np.: sekretariat instytutu, dziekanat lub rektorat, w tytule e-maila i w nagłówku wpisujecie osobę, do której kierujecie e-maila wraz z jego tytułami naukowymi np.: 'Szanowny Pan Prorektor - dr hab. Jan Kowalski, prof. PL'. Używanie w e-mailu do wykładowcy wyrazów slangowych, typu 'ziomki', 'ekipa' czy 'zajefajne' jest niedopuszczalne. Przed wysłaniem e-maila sprawdzamy, czy nie zrobiliśmy w nim błędów ortograficznych, pamiętajcie o interpunkcji, która może zmienić cały sens zdania.",
            "keywords": [
                "styl pisania",
                "etykieta mailowa",
                "język formalny",
                "poprawność językowa",
                "komunikacja akademicka",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Zasady kontaktu bezpośredniego z wykładowcami",
            "description":
                "Wytyczne dotyczące właściwego zachowania i form grzecznościowych w bezpośrednim kontakcie z kadrą akademicką",
            "textContent":
                "Nie podajemy dłoni wykładowcy jako pierwsi. Zwracamy się do wykładowcy w formie: 'Panie + tytuł', nie dopuszczalnym z kolei jest używanie zwrotu 'Panie + imię'. Ponadto, nie każdy wykładowca jest profesorem, należy używać właściwych im tytułów. Używając stopnia/tytułu, wymieniamy go tylko raz na początku zdania. Wypowiedź typu: 'Panie Doktorze, czy Pan Doktor może zrobić egzamin jutro, bowiem Panie Doktorze tak nam pasuje, Panie Doktorze' jest po prostu śmieszna.",
            "keywords": [
                "etykieta akademicka",
                "kontakt z wykładowcą",
                "formy grzecznościowe",
                "tytuły naukowe",
                "savoir-vivre",
                "komunikacja bezpośrednia",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title":
                "Przewodnik po tytułach naukowych i zwrotach grzecznościowych",
            "description":
                "Kompleksowe wyjaśnienie hierarchii tytułów naukowych oraz właściwych form zwracania się do pracowników akademickich i administracyjnych uczelni",
            "textContent":
                "Tytuły są ustawione według hierarchii ważności - od najniższego do najwyższego. Stopnie naukowe i odpowiadające im zwroty grzecznościowe: do inżyniera (inż.): 'Panie Inżynierze', 'Pani Inżynier'; do magistra (mgr) oraz magistra inżyniera (mgr inż.): 'Panie Magistrze', 'Pani Magister'; do doktora (dr): 'Panie Doktorze', 'Pani Doktor'; do docenta (doc.): 'Panie Docencie', 'Pani Docent'; do doktora habilitowanego (dr hab.): 'Panie Profesorze', 'Pani Profesor'; do doktora habilitowanego profesora PŁ (dr hab. prof. PŁ): 'Panie Profesorze', 'Pani Profesor'; do profesora zwyczajnego (prof.) lub (prof. dr hab.): 'Panie Profesorze', 'Pani Profesor'. Jeśli do magistra zwrócicie się 'Panie Doktorze', nie powinno być problemu, ale będzie to niezręczna sytuacja. Dużo gorzej, jeśli do doktora habilitowanego zwrócicie się 'Panie Magistrze' - wówczas reakcja zależy od poczucia humoru wykładowcy. Osoby pełniące funkcje administracyjne: do Dyrektora instytutu lub katedry: 'Panie Dyrektorze', 'Pani Dyrektor'; do Dziekana i Prodziekana: 'Panie Dziekanie', 'Pani Dziekan'; do Rektora: 'Panie Rektorze', 'Pani Rektor', w sytuacjach oficjalnych stosuje się też zwrot 'Wasza Magnificencjo/Magnificencjo Rektorze'; do Prorektora: 'Panie Rektorze', 'Pani Rektor'.",
            "keywords": [
                "tytuły naukowe",
                "hierarchia akademicka",
                "zwroty grzecznościowe",
                "etykieta akademicka",
                "stopnie naukowe",
                "funkcje administracyjne",
                "savoir-vivre akademicki",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Zasady zachowania podczas zajęć akademickich",
            "description":
                "Wytyczne dotyczące dress code'u, używania telefonów i spożywania posiłków podczas zajęć uniwersyteckich",
            "textContent":
                "Strój to nie wszystko, ważne to, co ma się w głowie, ale na egzamin warto ubrać się galowo (tak, by nie wzbudzać wątpliwości czy przyszliście na egzamin, czy na spotkanie z kolegami). W czasie zajęć i wykładów wyłączamy telefony komórkowe lub ustawiamy je na tryb 'cichy' ewentualnie 'wibracje'. Nie jemy podczas zajęć, jeżeli jednak zaschnie Ci w gardle, nikt nie wyrwie Ci butelki z wodą lub napojem z rąk. Jeśli musisz wyjść na chwilę z sali to powiedz prowadzącemu o tym (bez szczegółów) używając odpowiedniego słownictwa. Telefony komórkowe, smartfony itd. - korzystanie w trakcie zajęć jest dopuszczalne tylko jeśli prowadzący wyraził na to zgodę, bo np. macie na nich pomoce dydaktyczne; natomiast przeglądanie stron, odpisywanie na smsy może swobodnie odbywać się w czasie przerw.",
            "keywords": [
                "etykieta akademicka",
                "dress code",
                "telefony na zajęciach",
                "zachowanie na wykładach",
                "savoir-vivre",
                "zasady podczas zajęć",
                "kultura studencka",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title":
                "Zasady punktualności i zachowania na zajęciach akademickich",
            "description":
                "Wytyczne dotyczące spóźnień, przerw między zajęciami oraz właściwego zachowania podczas zajęć",
            "textContent":
                "Spóźnianie nie jest powodem do przeszkadzania w zajęciach. Jeśli się spóźniłeś/łaś to wejdź i postaraj się tak zająć miejsce jak najbliżej wejścia, żeby nie przeszkadzać w zajęciach. Na końcu zajęć podejdź do prowadzącego i wyjaśnij powód. Przerwy między zajęciami - wystarczy spytać czy możecie wejść do sali, zwykle prowadzący pozwalają. Pamiętajcie, że zazwyczaj jest to jedyny moment kiedy wykładowca może się posilić i zregenerować siły przed następnymi zajęciami, więc postarajcie się to uszanować oraz rozmawiać ze sobą ciszej.",
            "keywords": [
                "punktualność",
                "spóźnienia",
                "przerwy",
                "etykieta akademicka",
                "zachowanie na zajęciach",
                "szacunek dla wykładowcy",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
        {
            "title": "Organizacja i obecność na zajęciach akademickich",
            "description":
                "Wskazówki dotyczące organizacji zajęć i usprawiedliwiania nieobecności",
            "textContent":
                "'Z kim i gdzie mam zajęcia?'... Wypadałoby zapamiętać z kim ma się zajęcia i w której sali. Przesiedzenie 1,5h ćwiczeń, napisanie kartkówki i otrzymanie informacji od prowadzącego, że nie jest się na liście jest wydarzeniem dość radosnym, ale raczej dla pozostałych uczestników. Nieobecność na zajęciach - postarajcie się nie wymyślać niestworzonych historii. Prowadzący są też ludźmi i cenią sobie szczerość, więc lepiej powiedzieć, że się zaspało niż opowiadać o kataklizmie na drodze dojazdowej, o którym żadne media nie napisały.",
            "keywords": [
                "organizacja zajęć",
                "nieobecności",
                "usprawiedliwienia",
                "szczerość",
                "lista obecności",
                "komunikacja z prowadzącym",
            ],
            "url": "https://weeia.samorzad.p.lodz.pl/info/savoir-vivre",
            "date": "2025-01-17T09:42Z",
        },
    ];

    await universityScraper.addArticlesToVectorDB(savoirVivreDocuments);
    ctx.response.body = savoirVivreDocuments;
    ctx.response.status = STATUS_CODE.OK;
};
