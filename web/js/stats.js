/* ----------------------------------------------------- Results/errors handling ------------------------------------------------------ */

function displayError(xhr, textStatus, errorThrown) {
    console.log(textStatus);
    console.log(errorThrown);
}

/* ----------------------------------------------------- Box plots -------------------------------------------------------------------- */

function graphNumericalQuery(feature) {
    var endpoint = "http://localhost:3030/movies/query";
    var query = `
    PREFIX : <http://127.0.0.1:3333/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?filmYear ?filmScore ?filmBudget ?filmGross ?filmRuntime
    WHERE {
        ?filmResource :score ?filmScore .

        OPTIONAL { ?filmResource :year ?filmYear .}
        OPTIONAL { ?filmResource :gross ?filmGross .}
        OPTIONAL { ?filmResource :budget ?filmBudget .}
        OPTIONAL { ?filmResource :runtime ?filmRuntime .}
    }`

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
                if (result[feature] === undefined){
                    return;
                }
                results.push([result['filmYear'].value, result[feature].value]);
            });
            numericalBoxPlots(results, feature);
        },
        error: displayError
    });
}

function calculateQuantile(data, percentile) {
    const index = (data.length - 1) * percentile;
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const lowerValue = data[lowerIndex];
    const upperValue = data[upperIndex];
    return lowerValue + (upperValue - lowerValue) * (index - lowerIndex);
}

function createD3BoxPlots(statistics, feature){
    const labels = Object.keys(statistics);

    const svgWidth = window.innerWidth * 0.8;
    const svgHeight = 400;
    const margin = { top: 80, right: 40, bottom: 80, left: 80 };

    document.querySelector('#ridgeline-plot').innerHTML = '';

    const svg = d3.select('#ridgeline-plot').append('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight);
    
    const xScale = d3.scaleBand()
        .domain(labels)
        .range([margin.left, svgWidth - margin.right])
        .padding(0.1);

    const overallMin = 0.95 * d3.min(Object.values(statistics), d => d.q1);
    const overallMax = 1.05 * d3.max(Object.values(statistics), d => d.q3);

    const yScale = d3.scaleLinear()
        .domain([d3.min(Object.values(statistics), d => overallMin), d3.max(Object.values(statistics), d => overallMax)])
        .range([svgHeight - margin.bottom, margin.top]);

    svg.selectAll('.box')
        .data(labels)
        .enter()
        .append('rect')
        .attr('class', 'box')
        .attr('x', d => xScale(d))
        .attr('y', d => yScale(statistics[d].q3))
        .attr('width', xScale.bandwidth())
        .attr('height', d => yScale(statistics[d].q1) - yScale(statistics[d].q3))
        .attr('fill', 'white')
        .attr('stroke', 'black');
    
    svg.selectAll('.median')
        .data(labels)
        .enter()
        .append('line')
        .attr('class', 'median')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d) + xScale.bandwidth())
        .attr('y1', d => yScale(statistics[d].median))
        .attr('y2', d => yScale(statistics[d].median))
        .attr('stroke', 'black');
    
    svg.append('g')
        .attr('transform', `translate(0, ${svgHeight - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .attr('dy', '-0.5em');
    
    svg.append('text')
        .attr('transform', `translate(${svgWidth / 2}, ${svgHeight - margin.bottom / 2})`)
        .style('text-anchor', 'middle')
        .text('Year');

    svg.append('text')
        .attr('transform', `translate(${margin.left / 4}, ${svgHeight / 2}) rotate(-90)`)
        .style('text-anchor', 'middle')
        .text(feature);

    svg.append('text')
        .attr('transform', `translate(${svgWidth / 2}, ${margin.top / 2})`)
        .style('text-anchor', 'middle')
        .style('font-size', '40px')
        .text(`Box plots of ${feature} per year`);
}

function numericalBoxPlots(results, feature) {
    /* Create an array per year */
    const years = {};
    results.forEach(function (result) {
        if (years[result[0]] === undefined) {
            years[result[0]] = [];
        }
        years[result[0]].push(result[1]);
    });

    /* Calculate statistics for each year */
    const statistics = {};
    for (const year in years) {
        const data = years[year];
        data.sort((a, b) => a - b);
        const q1 = parseFloat(calculateQuantile(data, 0.25));
        const median = parseFloat(calculateQuantile(data, 0.5));
        const q3 = parseFloat(calculateQuantile(data, 0.75));

        statistics[year] = {
            q1: q1,
            median: median,
            q3: q3,
        };
    }

    createD3BoxPlots(statistics, feature);
}

/* ----------------------------------------------------- Chloropleth map -------------------------------------------------------------- */

function graphCountryQuery(feature, metric) {
    const endpoint = "http://localhost:3030/movies/query";
    const query = `
    PREFIX : <http://127.0.0.1:3333/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?country (${metric}(?${feature}) AS ?result)
    WHERE {
        ?filmResource :country ?countryResource ;
                    :score ?filmScore .
        ?countryResource rdfs:label ?country .
    
        OPTIONAL { ?filmResource :gross ?filmGross .}
        OPTIONAL { ?filmResource :budget ?filmBudget .}
        OPTIONAL { ?filmResource :runtime ?filmRuntime .}
    }
    GROUP BY ?country
    ORDER BY ?country`;
    
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
                if (result['result'] === undefined){
                    return;
                }
                results.push([result['country'].value, result['result'].value]);
            });
            chloroplethMap(results, feature, metric);
        },
        error: displayError
    });
}

function chloroplethMap(results, feature, metric) {
    document.querySelector('#chloropleth-plot').innerHTML = '';

    const margin = { top: 50, right: 0, bottom: 0, left: 0 };

    const svg = d3.select("#chloropleth-plot")
        .append("svg")
        .attr("width", window.innerWidth * 0.8)
        .attr("height", 450)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const projection = d3.geoMercator()
        .fitSize([window.innerWidth * 0.8 - margin.left - margin.right, 400 - margin.top - margin.bottom], countries);

    const path = d3.geoPath()
        .projection(projection);

    const colorScale = d3.scaleSequential()
        .domain([0, d3.max(results, d => +d[1])])
        .interpolator(d3.interpolateBlues);

    const countryResults = new Map(results);

    svg.selectAll("path")
        .data(countries.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const country = d.properties.ADMIN;
            const value = countryResults.get(country);
            return value ? colorScale(+value) : "#ccc";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .append("title")
        .text(d => d.properties.ADMIN);

    svg.append("text")
        .attr("x", (window.innerWidth * 0.8 - margin.left - margin.right) / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "40px")
        .text(`Chloropleth Map of ${metric} ${feature} per country`);
}

/* ----------------------------------------------------- Initialization --------------------------------------------------------------- */

$(document).ready(function () {
    graphNumericalQuery("filmScore");
    graphCountryQuery("filmScore", "MIN");
});

/* ----------------------------------------------------- Event Handling --------------------------------------------------------------- */

$(document).ready(function () {

    /* Handle box plots button click */
    document.querySelector('#numerical-btn').addEventListener('click', function () {
        const option = document.querySelector('.select-container #numerical-select').value;
        graphNumericalQuery(option);
    });

    /* Handle chloropleth map button click */
    document.querySelector('#map-btn').addEventListener('click', function () {
        const feature = document.querySelector('.select-container #map-feature-select').value;
        const metric = document.querySelector('.select-container #map-metric-select').value;
        graphCountryQuery(feature, metric);
    });
});
