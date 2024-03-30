/* ----------------------------------------------------- Results/errors handling ------------------------------------------------------ */

function displayError(xhr, textStatus, errorThrown) {
    console.log(textStatus);
    console.log(errorThrown);
}

/* ----------------------------------------------------------- Initialization --------------------------------------------------------- */

function graphDistinctQuery(feature) {
    var endpoint = "http://localhost:3030/movies/query";
    var query = `
    PREFIX : <http://127.0.0.1:3333/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?${feature}
    WHERE {
        ?film :${feature} ?${feature} .
    }
    ORDER BY ?${feature}`

    $.ajax({
        url: endpoint,
        dataType: 'json',
        data: {
            queryLn: 'SPARQL',
            query: query,
            limit: 'none',
            infer: 'true',
            Accept: 'application/sparql-results+json'
        },
        success: function (data) {
            let results = [];
            data.results.bindings.forEach(function (result) {
                results.push(result[feature].value);
            });
            initializeDropdown(results, feature);
        },
        error: displayError
    });
}

function initializeDropdown(results, feature) {
    const dropdownContent = document.querySelector(`#${feature}-dropdown .dropdown-content`);
    for (const result of results) {
        const option = `
        <div class="checkbox-option">
            <input type="checkbox" checked="true" id="option-${result}" name="option-${result}" value="${result}">
            <label for="option-${result}">${result}</label>
        </div>`;
        dropdownContent.innerHTML += option;
    }
}

$(document).ready(function () {
    graphDistinctQuery("genre");
    graphDistinctQuery("rating");
});

/* --------------------------------------------------------------- Search ------------------------------------------------------------- */

function graphSearchQuery(search, genres, ratings) {
    const genreFilter = '?filmGenre IN (' + genres.map(genre => `"${genre}"`).join(",") + ')';
    const ratingFilter = '?filmRating IN (' + ratings.map(rating => `"${rating}"`).join(",") + ')';

    var endpoint = "http://localhost:3030/movies/query";
    const query = `
    PREFIX : <http://127.0.0.1:3333/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?filmName ?filmGenre ?filmRating ?filmScore
    WHERE {
        ?filmResource :name ?filmName ;
                    :genre ?filmGenre ;
                    :rating ?filmRating ;
                    :score ?filmScore ;
                    :star ?actorResource ;
                    :writer ?writerResource ;
                    :director ?directorResource .
        ?actorResource rdfs:label ?actorName .
        ?writerResource rdfs:label ?writerName .
        ?directorResource rdfs:label ?directorName .
        FILTER (
            regex(?filmName, ".*${search}.*", "i") ||
            regex(?actorName, ".*${search}.*", "i") ||
            regex(?writerName, ".*${search}.*", "i") ||
            regex(?directorName, ".*${search}.*", "i")
        )
        FILTER (${genreFilter})
        FILTER (${ratingFilter})
    }`;

    $.ajax({
        url: endpoint,
        dataType: 'json',
        data: {
            queryLn: 'SPARQL',
            query: query,
            limit: 'none',
            infer: 'true',
            Accept: 'application/sparql-results+json'
        },
        success: function (data) {
            displayNetflixLikeResults(data.head.vars, data.results.bindings);
        },
        error: displayError
    });
}

function displayNetflixLikeResults(headings, results) {
    if (results.length === 0) {
        document.querySelector('#movie-table tbody').innerHTML = '<tr><td>No results found</td></tr>';
        return;
    }

    const tableHeadings = document.querySelector('#movie-table thead tr');
    for (const heading of headings) {
        const headingTh = `<th>${heading}</th>`;
        tableHeadings.innerHTML += headingTh;
    }
    const tableBody = document.querySelector('#movie-table tbody');
    tableBody.innerHTML = '';
    results.sort((a, b) => b.filmScore.value - a.filmScore.value);
    for (const result of results) {
        const bodyTr = document.createElement('tr');

        const createTd = (value) => {
            const td = document.createElement('td');
            td.textContent = value;
            return td;
        };

        bodyTr.appendChild(createTd(result.filmName.value));
        bodyTr.appendChild(createTd(result.filmGenre.value));
        bodyTr.appendChild(createTd(result.filmRating.value));
        bodyTr.appendChild(createTd(result.filmScore.value));

        bodyTr.addEventListener('click', () => {
            graphDetailsQuery(result.filmName.value, result.filmGenre.value, result.filmRating.value, result.filmScore.value);
        });

        tableBody.appendChild(bodyTr);
    }
}

/* --------------------------------------------------------- Film details query ------------------------------------------------------- */

function graphDetailsQuery(name, genre, rating, score) {

    var endpoint = "http://localhost:3030/movies/query";
    const query = `
    PREFIX : <http://127.0.0.1:3333/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?filmName ?filmRating ?filmGenre ?filmYear ?filmScore ?directorName ?writerName ?actorName ?filmCountry ?filmBudget ?filmGross ?filmCompany ?filmRuntime
    WHERE {
    ?filmResource :name ?filmName ;
                    :rating ?filmRating ;
                    :genre ?filmGenre ;
                    :score ?filmScore ;
                    :director ?directorResource ;
                    :writer ?writerResource ;
                    :star ?actorResource ;
                    :country ?countryResource ;
                    :company ?companyResource .

    ?directorResource rdfs:label ?directorName .
    ?writerResource rdfs:label ?writerName .
    ?actorResource rdfs:label ?actorName .
    ?countryResource rdfs:label ?filmCountry .
    ?companyResource rdfs:label ?filmCompany .

    OPTIONAL { ?filmResource :year ?filmYear .}
    OPTIONAL { ?filmResource :gross ?filmGross .}
    OPTIONAL { ?filmResource :budget ?filmBudget .}
    OPTIONAL { ?filmResource :runtime ?filmRuntime .}

    FILTER (
        regex(?filmName, "${name}", "i") &&
        regex(?filmGenre, "${genre}", "i") &&
        regex(?filmRating, "${rating}", "i") &&
        ?filmScore = "${score}"^^<http://www.w3.org/2001/XMLSchema#double>
    )
    }`;

    $.ajax({
        url: endpoint,
        dataType: 'json',
        data: {
            queryLn: 'SPARQL',
            query: query,
            limit: 'none',
            infer: 'true',
            Accept: 'application/sparql-results+json'
        },
        success: function (data) {
            displayFilmDetails(data.head.vars, data.results.bindings);
        },
        error: displayError
    });
}

function displayFilmDetails(headings, results) {
    /* Open the modal */
    document.querySelector('#movie-popup').classList.toggle('active');

    /* Clear the modal content */
    document.querySelector('#movie-popup .popup-content h2').innerHTML = '';
    document.querySelector('#movie-popup .popup-content p').innerHTML = '';

    /* Remove from the headings the ones for which there are missing results */
    for (const heading of headings) {
        if (results[0][heading] === undefined) {
            headings.splice(headings.indexOf(heading), 1);
        }
    }

    /* Fill the modal content */
    document.querySelector('#movie-popup .popup-content h2').innerHTML = results[0].filmName.value;
    for (const heading of headings) {
        if (heading === 'filmName') {
            continue;
        }
        let result = results[0][heading].value;
        if (heading == 'filmBudget' || heading == 'filmGross') {
            result = result.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            result = '$' + result;
        }
        document.querySelector('#movie-popup .popup-content p').innerHTML += `<strong>${heading}:</strong> ${result}<br>`;
    }
}

/* ------------------------------------------------------- Event handling ------------------------------------------------------- */

$(document).ready(function () {

    /* Handle search button click */
    document.querySelector('.search-btn').addEventListener('click', function () {
        const search = document.querySelector('#search-bar-content').value;

        const activeFeatures = (feature) => {
            return Array.from(document.querySelectorAll(`#${feature}-dropdown input[type="checkbox"]`))
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.nextElementSibling.textContent.trim());
        };

        document.querySelector('#movie-table thead tr').innerHTML = '';
        document.querySelector('#movie-table tbody').innerHTML = '';

        graphSearchQuery(search, activeFeatures('genre'), activeFeatures('rating'));
    });

    /* Handle search bar input */
    document.querySelector('.search-btn').setAttribute('disabled', true);
    document.querySelector('#search-bar-content').addEventListener('input', function () {
        const search = document.querySelector('#search-bar-content').value;
        document.querySelector('.search-btn').disabled = search === '';;
    });

    /* Handle interactions with the modal */
    document.querySelector('#movie-popup #close-popup-btn').addEventListener('click', function () {
        document.querySelector('#movie-popup').classList.remove('active');
    });
});