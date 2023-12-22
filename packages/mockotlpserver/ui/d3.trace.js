/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// Self made
function Trace(
    data,
    {
        // data is tabular (array of objects) or hierarchy (nested objects)
        path, // as an alternative to id and parentId, returns an array identifier, imputing internal nodes
        id = Array.isArray(data) ? (d) => d.id : null, // if tabular data, given a d in data, returns a unique identifier (string)
        parentId = Array.isArray(data) ? (d) => d.parentId : null, // if tabular data, given a node d, returns its parent’s identifier
        children, // if hierarchical data, given a d in data, returns its children
        format = ',', // format specifier string or function for values
        value, // given a node d, returns a quantitative value (for area encoding; null for count)
        sort = (a, b) => d3.descending(a.value, b.value), // how to sort nodes prior to layout
        label, // given a node d, returns the name to display on the rectangle
        title, // given a node d, returns its hover text
        link, // given a node d, its link (if any)
        linkTarget = '_blank', // the target attribute for links (if any)
        width = 640, // outer width, in pixels
        height = 400, // outer height, in pixels
        margin = 0, // shorthand for margins
        marginTop = margin, // top margin, in pixels
        marginRight = margin, // right margin, in pixels
        marginBottom = margin, // bottom margin, in pixels
        marginLeft = margin, // left margin, in pixels
        padding = 1, // cell padding, in pixels
        round = false, // whether to round to exact pixels
        color = d3.interpolateRainbow, // color scheme, if any
        fill = '#ccc', // fill for node rects (if no color encoding)
        fillOpacity = 0.6, // fill opacity for node rects
    } = {}
) {
    // Get limits
    const topSpanCount = data.children.length;
    const traceStart = data.children[0].start;
    const traceEnd = data.children[topSpanCount - 1].end;

    data.start = BigInt(traceStart);
    data.end = BigInt(traceEnd);

    // Flatten the tree
    const flatData = (node) => {
        if (node.children) {
            return [node, ...node.children.map(flatData)];
        }
        return [node];
    };
    const spanArray = flatData(data).flat(Infinity);
    spanArray.forEach((s) => {
        s.start = Number(s.start - traceStart);
        s.end = Number(s.end - traceStart);
    });

    console.log('spanArray', spanArray);

    const x = d3
        .scaleLinear()
        .domain([data.start, data.end])
        .range([marginLeft, width - marginRight]);

    // TODO: change scale to get thiner bars
    const y = d3
        .scaleBand()
        .domain(spanArray.map((s) => s.id))
        .rangeRound([marginTop, height - marginBottom])
        .padding(0.1);

    const svg = d3
        .create('svg')
        .attr('viewBox', [-marginLeft, -marginTop, width, height])
        .attr('width', width)
        .attr('height', height)
        .attr('style', 'max-width: 100%; height: auto; height: intrinsic;')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10);

    // Append a rect for each letter.
    svg.append('g')
        .attr('fill', 'steelblue')
        .selectAll()
        .data(spanArray)
        .join('rect')
        .attr('x', (d) => x(d.start))
        .attr('y', (d) => y(d.id))
        .attr('width', (d) => x(d.end) - x(d.start))
        .attr('height', y.bandwidth());

    // Append a label for each letter.
    svg.append('g')
        .attr('fill', 'white')
        .attr('text-anchor', 'end')
        .selectAll()
        .data(spanArray)
        .join('text')
        .attr('x', (d) => x(d.end))
        .attr('y', (d) => y(d.id) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('dx', -4)
        .text((d) => d.name)
        .call((text) =>
            text
                .filter((d) => x(d.end) - x(d.start) < 20) // short bars
                .attr('dx', +4)
                .attr('fill', 'black')
                .attr('text-anchor', 'start')
        );

    return svg.node();
}
