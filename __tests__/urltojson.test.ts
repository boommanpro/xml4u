import { urlToXML } from "@/lib/worker/command/urlToJSON";

describe("urlToXML", () => {
  test("complex", async () => {
    const m = await urlToXML("https://xml4u.com/editor?a=1&a=2&b=&c=https%3A%2F%2Fxml4u.com%2Feditor%3Fc%3D1");
    expect(m.parse).toEqual(true);
    expect(m.text).toContain("<Protocol>https</Protocol>");
    expect(m.text).toContain("<Host>xml4u.com</Host>");
    expect(m.text).toContain("<Path>/editor</Path>");
    expect(m.text).toContain("<Query>");
    expect(m.text).toContain("<a>1</a>");
    expect(m.text).toContain("<a>2</a>");
    expect(m.text).toContain("<b></b>");
    expect(m.text).toContain("<c>");
    expect(m.text).toContain("<Protocol>https</Protocol>");
  });
});
