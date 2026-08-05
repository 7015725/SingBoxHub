/* SingBoxHub Stage54 production lifecycle UI promotion packed module. Rhino ES5 only. */
(function () {
    "use strict";

    var P = Packages;
    var Base64 = P.android.util.Base64;
    var ByteArrayInputStream = P.java.io.ByteArrayInputStream;
    var ByteArrayOutputStream = P.java.io.ByteArrayOutputStream;
    var GZIPInputStream = P.java.util.zip.GZIPInputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var DATA =
        "H4sIAAAAAAAC/9V9f3Mbx5Ho//oU67VsAhIAAhRJ0aRpFwiCEmOK5AGgZUdQUCtgSW4E7uJ2F6R4sl7ZqSQvyVMSJy8v98upnJK7xO/exbm6qjiJE+c+zJmU" +
        "9Ve+wnXPzO7Ozo/FglHu6slV5mKnu6enp6ene6ZndvaK0XbcgzXvwc3xPaMdWgf2wrwx8r3BuB86nmsMnX27f9of2sbeJr4/8vB1xWgdOq5nNNsLhucOTyvG" +
        "ldlL7bWblWPbD6A8qPhjN3SO7N2Y0lZEaM/ZjcgYq0Zt5dKlwv7YpbUVisbDSwb8M8eBbQSh7/RDEyDw1bHlG7uAsWv17wObwUr8tnPo29YAiypfto6tytBy" +
        "Dyr0ZQLUGruudQ/akQaLXieA7UN7OGx4R0eWCzTJa/y3Wwk937X6XsUajYJKcOj54YNK3/PtCoglhNekCRUePSG65fWtYdvr37dDwgAU+p4zqLh2WOHKlAj1" +
        "wcC3gyALj4Ek6Gvj/X3btwe3fSe0/aTNjldJFyUoO+NwNA7bIYjtSIEmF8u1tUDimtpoUYKy6cbUFFhSKdc9dn/s2y0QhHeU4AT41glPK3wx1/n2/tDuh3Xf" +
        "t04FBfBpUYWUJRhfAIC101BUF3yVBgIuYQAJYPQlJyArsBfnUz04Dp1hhb5P4DZ868jesk69cVpNTpzBAfQ4V5zg3PCtY2h5Cv7YsU8qrCCB9HznwHGt4U3v" +
        "CNuF49UFkAOLKO4IB9Wd6l0Zftsb2IEOoaZAADvihwwBRkslwN8J2G1WRFvFaW2DFYSH9pENY2vo+VzpvXGArdy3hgHXB9Qm2QO5ZGgFYdu1RjBUkRl3PBxy" +
        "pqS+17m509r8Yr2zubPd21znhroZUDtYZkasnNjDcmwPy2OnHNvDMpgrv2yNQ7AKzl/Zg/JcdW6xulRdMDnF3dlrNZq9rc2NZuPtxlazN5mDa2XfDv3ThBE0" +
        "NxwLfc8NfW84hLq9ExeqzcNGs/Vms9VrbNXbbb7GvndUCUBp73kPDsf3IvtdaUCNLfp8y3JcjlBja7O53ZmKUGPo2G4o0GnvNN5odnqtZn2919m81dzZ6/Ru" +
        "AUVjbqFa5aq72Wy8EQO0m42d7XWEulZlnRpPIq53Es8j+A9kOPZdY3t8dM/2C6lhehqE9lEFLIYPfHWwjc5w6ASFYpFW/Egg/ZdjULXCsTUc24oazBnTuGrQ" +
        "sc+AwLyMhlbfLszOzB6UAKLbnZkxiwAGwOo6sFPtB+GbiF8YWKFVMu7bp3x1KA5CHpqPABUYRQVWLYIy5jnOGPQqHQXGO+9wb8buwN53QHuM12M00pGmsZxu" +
        "jJrfI8u/D3L1rZOS4YJ9EjkdAm1iPSgpgMP6TbNYCUZDJyzMdv3Xu+4sxzQd1sDUA0Azez0wCT1OsrSSq1iyaqaxHGjLgxWpeqYhhG3PNwoEDGgT1ipD2z0I" +
        "D40y+CKUgPHaqlGNnsvgo/BNwn+Il7SIULlDoO9yrcB/zr5BiiukdGe/QJtVJIKvimS5DiNIwfheQKugaIxToY5Hl+QnRoWaPFWnndqBuscYptypyLFZ0+is" +
        "S8YWVVmtIkQqK9EWet7yA2LO2YDldU9S6RcilX75ZcMJNhwXHJMCpVA0Xo9oLWdIwn4AHkNoE7et0Kd+W8kYjf2RF0hNoD4edj3n5YEzdrI2dobgphSKqa4B" +
        "tyRkQNH4ZDUUZUD0w4fAhxcWQh9aLAFsDgqSupiJ9/4i895f5IZK3AwYLfhewmdwOOkSh8QnjlPHu2+7BYFHgaF72OKC0HfghI6HONky95gJt07EVqDSE1DQ" +
        "gAECxaww47cOL9NgQTigTpHCPJoB9gY4qGZRQrJ9Pwup6fuIJCpXelz2wf9ZjtQxNriUQAPKzGKxlELwiK+8HDF91SgwTl43zK6L/cN+L6MdTMavWkPZDNry" +
        "QDMUQ5V1IZM4cNbGp7fWHdBG0vGziY7oppwhKMlfjB07HJ7Ksxt4IIJA0KzJ4y95E08pKgtHwCqkyoJgyrhW4RDQ2jmjb4X9Q7DjBy54FViLZPo4X1CSJ9Hx" +
        "m/aDwj3w5hseiFcc534UXsDQTkUcosIjBZzc+AAD7cGmCx6cC/N+FEdUOm/vNktGUmOaDtUYIHTn7sQZjQhQspkhr8WEV+DjQYh1B6ShAVdlahaMp7pXaXPY" +
        "NBO9vaqYACNTzsYEQdPPgBT6VfWERwuvoru3qOtw/DeiIQXVntBjWl9bFOqjgqyMxsEhzgNhNLvj9FXD8VfF4UeILZM/HL6kRIzYlz3HLZimxv8Z2Ggfmu5g" +
        "BGChPHx4NUmmoagEzZJUII+4iAANGCu0zkLKOytFhevNjfreVkcQDKso8qFAr5PolXYg2MS9zkZ5ySwKqEwaX2jvbFfIjFpAYrzgogEJNs3zxV4OD33vhIyk" +
        "JhYXzOb2+u7OJsQOSLG3W2+1m72N+uZWc91MEd3HWHKoE0VaZFwT0wWP1LM+coK2W2Y56pV0Px1hA7N6KC3feEIl5DtQxipSSS0xYxkUKbpKWQlrAIjwFfKj" +
        "MHunXv7iXfxftfxK7+7Da6VHs7ILRRFfj2ogP+9U7xaN5XQgsNvaWd9rkCg1iV73Nnvw/tYOec16Tz1AAmvfBt8kHAeqwUENCa/JLDxYkYDo2I8jqjtfgvZZ" +
        "5b/CJlaWy3dJgNUzNa4i501XS8bivGY0B4TRduiNRvZgKn7BKO0Bkt+w0hObFIKZ7c7O7i6IKx2HmfUtjIHf7kXFmtnLDryx37c32ItA5RPcSXegPx7a870+" +
        "zjuF4kPDGRnleQNfop92Ysy9Njuwj2dpaGhYJ/eNGZWvaF6uGf/DmP3SHRD43avLl2eNh6PVyxA0gWQLs/C71DW7ZmlUXDGU6DgVjF5bXVqqVtFdGL0Kj7WF" +
        "otG/evWRATbh4QhkGsLP6qOZFeORWZIbsZhuxOL/f42AKUXRFfiWNiMka9Rz1bn5qtAkJTukndsbD6epXhbin636GOOuWpmdgQ2+bXg6jTITM9VjS1/YCCVn" +
        "u6td6OquuWLcMcq+0TVnR77Xn728O9s/GmB03TWNuzgAWSU1TX+/uXoZwjFjptutVqszBv73qpoaJy6d8vTBNADy5TcB3HGNK/BIl+O6Jj43Nm7Qh9s7rTfg" +
        "qRgxV13REExAagBiB1Zf0el98AYdCFvs3r5jDwdBDpm9tapqooYJJuDLb+UUab11oy1Itdt1qVwJkRyShDpdBEdaeautQqVEP/eNmZcCUmVC4R0DFwqA6Ext" +
        "NKOrdW1z/a3VMlTQiB7wb1UDfXLowFja3GhjdGsNUEr1FWPgKaFZq5Ah4GYVH9Y2t0nTwMzcob/X3yJl5Rp9S9i5DP9byUuSaBhHsiGSbOQgSUAKBfgDnnSt" +
        "qBPWwHPB6X+1uVPvulTKLnlWq94ukCTWZPZLu7vOYBntMrEll+dAsR844aMZftjRaTqfruwlpPeeL+V2QhkdHPt50o6HvjygqQUcehBB93BHIMeAFm0Adv5u" +
        "18wxbO5EoC9QDdrdXE+p0B7Rnyp9o6fQphS+yGHWqwpN11OI1b8qK3D5wIbo7q5WVv/tUtrdjYcgV6QntSe1NC1APaZSqkoB6mlMlCrKsxewvTWtYBs7e9sd" +
        "NI9bOzvtJj5A27XmEtck3sJpkQ4X4qBdiSafSXZTmIHQO3DcMaCBXXn41ouU5CP6c/eliOqjDCsHjp44zlgfr0BEa7usUWAIyUNkCvedPDRlalRWQI08RNRQ" +
        "XhGYjjIxtHmcrf6h3b8feVoqR8skEOha7TsHql7FBrAFbKN8bOCqJK5vcn7i3Gsv11iLlLxGKNwatXJjr6hCDhKtJpwa5X4yqUlMSMzbQ+p95aaAEn+kCcNG" +
        "VnjYttMLsmTl0CObzak125Xs5WVEWSb/LwnLztgP645PC8lSLn1nqgAlqNlo1zgcu5UvB54roN1zXMs/5dDgxSzu3JbveQ8E2IBMbwko+S3AsOq+YPnL8qpu" +
        "hMiAZnEEcAvT3DZz5cuWL1A+8fz7yxoaWCbLA2MDJQYpEeBttnaXi21CIPrbi1BV8vXtvnds+6f18cDJok1kGVEsB7Z/7PTtMmYvlCMSKvJxGkBe+qnUAeDZ" +
        "PvAtmtMAValqiNMb8tUwMUtich0d+2g0sZ7K5HQMle1Jlv2XyLZIJTwamZP2XsguV5REEm3l4dgPdNvcQrQ6PrKC+0b1+nVxCm3t7HRW0QzSnAJCs4ItFfaS" +
        "zHUJKjYMIijYMQ2wCAk2UIKk9kCEbHfqnaYES3pCBP1CvSW3KDYKIjQGuRI4jmapVZ3WlqpZOFxE2GhpWYKPBqqI0IL5BgLwt3v1vfVNRYfwY1jE5VN5VMjp" +
        "ESoJlkT+HBKfmSMB0+QhTBniMSalFIlkbmBfusRfaOysg0smauW+4zrBIc79UaRM0y8QsddbTcJmfIFeSRoMiabA8IUMtr6zjWA1hKJxkjLO2bccssBDuI58" +
        "dMI3/JijPhGyq3J+ojSNIE7zAI3pW2FBsX5anICiWKUSUeiGk+BhTaIrmIq9zXVcbXLAtxqnIkRRLmlhAlpK5Eima4o4d5IiFgGAm4wCJta1N4Zal6o1Gas8" +
        "QEQ0Vkks8YJR3kq9jUnRwd4jBnupOqcjty7TWk8RokarN3Bg/IWefwrErumIEQMlE0xeR0SJzUrRnFdKqYCA6Bm+ZPGE+B4hQrxerUrUj7yBbWDCXTbhcSZh" +
        "PuxLcA4m4qRZwYxAH3hZ1AkO7aost/gt1xfE1eEFd11Hk65cijTjtxFNNPMpgksKgvuICnOKTC96KeodeI5A6xUdrVRAXH4gvYrIRy9jedJsxh6dII2lWlVX" +
        "Q2p9LZYoexmRS9wXFmoBxVoeTaSEpK5frKoVZpyBk6FiGRjaFvSO7NAimTxLNWnUtxsY84Pm3miuzsxIRh7C/g0M+6kRmK2IUUuF5MKWr5AlABA0ieE25Egf" +
        "qoHwud2IYmdaIYVFXNdWyrjdIM2rpcfPAXQ53SaBFl3TdTepQml6bkimh1DcxxXhpZpkdxo3gffg0JpbWAzGR8peiDa1ogXG2qMZaWJorK1yvRlo6Lxj2P1D" +
        "zyjXJPy2xEbUlCkZacuMKCnpWYkW+Bs30wvWN6PVrbZQsBYXrOlGW9QLOAmDSkFHSHaaXwFZoTnHq5dfVyoOKcwxNOhCw1JtUadFaRdUMc3K5bHhY+5pz0IP" +
        "s3fkBGiroLLreeyJRHg60zIZPcPK5EPWtTOxNtqJQ3DOZbGqAKL6Ys9dEuwreQQrk55OsjnwM0SbE1vb1li4c9I8d+DbI6O8Ycx0zeiUAVlC2Bx0zeWuOYPD" +
        "L4lUyIsZNUvCYpuWm1Q1wFItgyWSL4QrSWQzhnAU0ESOP5kNQrpHHCtgYk6ndFH4KWtbqiSqJQpKE/2au5ZHvzhi0ylWFmKGRk1Ck9uT6JDGx8YdUbDD92XB" +
        "STVMlF7fgpDW6VtDqE6y6LjfgpMR290NZitXumZ0OtEBzbhzZzkYWX17+e7dK8v8j263QDYh6E5Et1usXJntdmuzoxmBpfTesbz9Tped2cYPeDozM+9cufMC" +
        "oVoUmjJyBj3HPbaGGI/NLbJNfZHkfQf0tVzlqAqzaspxZyuKPRfiPCB8jBp8XbdPRlA4wjpiUUwMtCQT3NgjIs+754o1qbdGJcI3eMI3nh9hOqHvkRYLG4w3" +
        "uJc6YbBQa+6VzH0ydaW43SPVSraUFNX6tBfBLlnu8LTHrJuxdE2y1J29bfS6ib88G5wGs/2hFQSzrh3OBvcO0blm9SGgZFRb8yBmLmsM3OnWInu1mLzqEDAu" +
        "pYm8XIxeRpDKhkO9UrNb8/KrRflVRwHWWVQ4Ddg/9qAHjSYBZ7T0E/RGWIa+/TWp6c3d3nq9U8cEFe8Uoj7jHj27qTVSMPxDH8PfmW7Xx0UYrS/LSKuNGEkR" +
        "Wbo2l73Y07iZXl67Ka/0CAhraYS1iQhkOy5dCXF0J6DtCstQ1H5MQELlF9YLyXDIRiOjI4XGxks2GmhcColoYDZKa2+rOZ9CQhWdjLOYxlmciLOz1xEr6szn" +
        "whKq6kysi2lhCi3WzGzUnTeiVVv1ujG3CitvetKlT5pLv2LosunJ1AdeVpxPHw2QEtlyDUpg5Ud2P7QHMHnzezCYmPlCBIzDi51NiHfoAgjEjqw36QUFRXJO" +
        "pZY/Vb0No+BWvbe5/WZ9azOdp55iQaw18TRolVE534h33pE2q7LIvDoV4y0YUJu3mj0cnxO5j3LNY5mhAfUbOHWwLGfSiNQZYgX3Ipk+OfcrkeFPEOdvEAEH" +
        "07HdadUbnenblOxI8byIu1V5mkXXA3cBU6bE1grzCIcsE6ipsPXBHFRwgoMX6/GaqkSLbK3llvJuvXNzCiG/kKgMuZBi2zqy87CdQBejkzqvGbW5JRXu7B2Y" +
        "X93uuAr/7s5WQjsICxn0ilMMbnoEfbsO42SKpoZ4TDJPKwlg3MBXjdri9Fiv4QGpi4qFkppCIp2dN5rb2bJgZj2qQ3OcAorZ2Y94B1bYOA+iW1Hkw1En0TUk" +
        "cpEfXRoiF4Gb7NtDi53UNcHdXZjHjAB2McBVwyS/knyA2px0bhQ53qKnvDMrSMFknA5KGgnC5i5uEU9AUjgc9y6MY/m8r4DO7n0pKNPNMsZGSYkgE64gNAmI" +
        "K/W1NrEFEqZwSljZHjze7HVo7ldBfeGDgJh0PbQ4fWWNWiry/TRqqTCODuyQxyhoRMJOxE3XaMp7hfzRDUUlBrQDFaqQRY9TvosTIVkde23zIhT2h7jVLR0R" +
        "jIYj11306h51d0k3/EzqLQ7huXZWaqzTZlTwj0oC8sCfgMD5HyIuNz/zXao4IStZadp5MDu3Ws0tmurRbNzc6d3abN+qdxo3zWLWQVoyh6WPuSUyKOZhQC38" +
        "5DRgq/kXe5utZjv2PdmJtp4uMZY7IcixIvdjVrOUqZW0IBh5bsAqWNZUJmsU1yu3cHHMHiyTU+klRQ1/OYZZl5zrXjZqaSYnH2hNnb6nCiXqHQ9Bh2EWBB00" +
        "et1VHp7NmPPUqp/nmK3jBhjnbLrAMTRdypYlnqmxmmTTCvMw3rAAxak7OjJS8vBWh2ixTSAV2V/5Zom0A5N2Abg5nQwbvDaFMFWhR8OhQsxlMjGGM1SlO2+Y" +
        "E70uSZ/YBSkCKcyCMpXBYsYB3ebG1uaNm53ogK7OECZDiZdTcleLwApbLuBlHEfeq3IIn6pVOC7P1ycMQhrvp17x98wIPOF6E3eXBsca7Uq8lEThjCpbkFZt" +
        "QSTpQuGSsXRPe/dVJoPlUkd7U+os6thakb+VtBFTpju36WI0Hp6aLCclhaHt7+A1YuSqLmrMsgjhUp1IiRyWIPjRUZrJhMjinUgo2UdvkBi4TbISljUKiXNe" +
        "Nv7aaR5WGmuT6DRwN3/XCgKYDmTHJoMyLqKa7OKndBXh2CUGch/c7F26ML1sKGxJZ29b5C5a4t4cHc+3xsMcLSQrmhlkFvOTWczkBjcActAhC5+Z/ExBSOKI" +
        "jp5GrpkcRx3AH42WaaB4STGFK50MYqeWVeaK8LhM/6gYi4a3UMbMyXLKuOTKVN9NZdOnJsdSNMqFdVP1IWtt2ro60zmdxS9mHXdu7U7AwLz/olRTKtd5Umoz" +
        "zTv4U5KjyU4xhx/57bHUpHbh+U+0ccbVlwJlYlNVm7v7sGumFqS75nKt1KX3PsLzwnxJnWLxUtA1EY5sZG0lCeZaSH6re/mlgNZBBgVpF7moCCw/lpIxQcr9" +
        "EEOD9pjYpEABQ5xQeq1XsIXuJlcGbHtHwEkf5wEKA4XkQiYoje7rrIdt8ATcQUDYehQfxyZ5I0acSEKf2WY0btrgOcjXyNMtdjST5I8vLdTkXK4jb0DyIRTQ" +
        "czK0d+Ia1WUOWpEcwrClLI2jY5bIQDFJQ2iGSYI0r8sa0SQopdKSGI2FPOkhF0s6ukiq0aQEI8b1Yva2EqGSOhSQB37t7Q6EmPwulpBxqGCOzziUN7voQQRu" +
        "E2vibhVTZm18w+Ifcp2hFAulAw6SZyTGOunzenoLL3kiccUVxbSUBoimm4rkR6ajBalLosNWhHOT97zloInAJLN10uOTwyNtdEOJKC6OupQ+XEakn75PTjmP" +
        "a731A1t29Uwhr9RemO9FaehcUZJHNnZ6scgExRPs/LJ0N7HAUabtl1mdOBFmcAOzRDA+UjtMsZ1v4SXF9eHQO0FAaugvpQNad2wNd9zhqYoOXm46dA4OQ+ZW" +
        "qzoBR8OeGNlwOpx2BvfkECfLj1dUmD66BXO0s+/kgdxIpSBqgzw5ZLvQAM0k6nswdQd1TPhS8c0uPW6lws08XKQCVCXNHO2PAHVxZ1UJv6WLLquZ8SwTBanN" +
        "6oeqwYx5d9HwHTuDas/yD46r7MRHlMltuac9csmhqdMt6SMHGnVWemAaSD8SE3PHJsB7oynAZTcuc6AnDt2me+zd14z2Pu1+P5wM5I2yYOgBIdZ7becAhlaT" +
        "fKxBDZ4OKRq+bWnEnwZskdDw2MYdeIVqPLezzckKROa6gXKmJL6OaNKU6wYKuUTR9DZNg2tFWXB7bv/Qcg/UMqIqf8sbMMOnoMuOU2TCAI9xR6hYw+A+k8DA" +
        "DTLL90FHTkC/M4FYAmCD7qo6+FWEDsT6mboH5T72+LG9M7LpQflAI15rcLrh+cpPndT7fXtEboJVCRkvaK3Ht/XH9Si0cJJrYcX1mLrFBNmUqyHb0bXGKRQy" +
        "weLKrWgaQFs5DKq9Mlx8VzJrbkiGnFqtELTjW1C3h7YPcFwwP0NvwvwUc0j21Kro6ifc0HfTLfgo7mGuB6duv+BFHVUy+qB696z+fTETDb9VITq2EWxB3qNC" +
        "11MhCrL6HN1UukzO4t9ogqMZ3RTZ2tve3ty+YcpY2raRhinvd1U50OyTG2nnGV1z+nWdwiVxWxfvlK0PrBFuv0ef1impNuXG7rIhf/ZH/JdcjbyiLcc02rGv" +
        "3rXSJ2SkpB9dvhx3LL2Qk4UPpvBhBPGfHAQuZ8JLgWA8INXMZ9+umzKGsSgI6MrkFj/M5DRDLXOESH/OkEniNLadyWM2xpRBV8awFO8SzoE4WVgT7xFO32c7" +
        "t7A4od5cXpkaKdtLE/8pvLa2zjWR65vodaiUb5IXIpmDbK9Evn9mkpciySC39zCV4dYkFuiTIgQ7zl2KL+kbKBp4gwOImSojLwgL2oqnMfMXMPnKGTNyh5mB" +
        "K65koj7SC00tTwW9R8KMKe42xDdXldlnN8rclWaxCeL2o+lHsApF3a3O++CmH65ZgwO7kISvkz/DgP3GjKjx8svqye90ZHv7BgdZYdURd4bOdREnpqpfdKjc" +
        "h/tYsa5XsyfgpMH4ubDhKVuUoNKIKE+YHNkl6gQn9UEIndej/55EizYxpiJntex7JNvLAcYxQ7IEwzbEEUBu8y4Z6I0rPirhncAYvF3xcVxza5HeCeZH7lqD" +
        "ATPmsdEfjArXiyVDeiVgA+abjn1SuF1Bhjiu5uZLRgO/jee5A7zaSYOXEsvtCt4jX2ANqs1VFlI0StSICOPhdmU4Qs5vV2636ruApkzESPNKqmECq12LhIZu" +
        "e4OUlYjbqfiYFZBRD6IhWcG4naxppIxMLMLQs8C+mWfv//LsWx/Onr33wfkvfnL29b89/9/f/uzTD87+9etnH3xIv4RpLCwYz/758fkPPj57/zsA/vQHH+o2" +
        "AqK1eebE3LR9TzOM+bwmNKXcN/3IYO6HD8RvjHiDU6I4fW84PnLFjYND+u1LSa9IprLj98knL/PVRNelwK5lVEdhWmpdJh/08aI8Z+F7hKTf1RXTLwMFOpK0" +
        "uD2V1Jg6rSabAK+DYt3D2/aX4cHzcelDaJq3r0Ro4/sECX8KH/HAwZLCTM8WT3/w488++Tn8/+x7n55978PzD36MX1M9+/W/nX/3/bNv/09T/OCCBv4PX2Pw" +
        "gsDtoO87I5bZp+XhWx+fv/ve57/83dl3fwg1U3X+4+8f02Fw9v3HwkB4+otvQoVU/SUGP//lr8++9g0YKJ9/6ytPv/LbZ09+9exHPzn/5s8/f/I4GjrzBmX2" +
        "2V9/+PRn75ncphCN1MHkrcHUfgDOlbiBlXwC8sC3Bnh0SPZG7pgvbtQ26huLZsmAx/mN6xtr9HENHmvmXdnNAmsoL6y82LzWrDcXTc2nrvg0MsJ2Yr9gNidP" +
        "zB6C5u6P4DXJwMVf5IE3XziOeUsvtTky8LUlwbw+p8JFZbuojRD6I+kC8htzhEHrS8YCGHn6VCvKNDQTCpmVzOAQ71SGPlqYj2dIcRZRSLAUfeC00mhud5ot" +
        "ZRvQBsa1U2ZKdFJKTZzzRWEmnS8WpURBMH98L6UkKBKYp7NzlSMC5m+iLGnrS8YrOLXiYW4faUictLj5EsgqWlSrCgzBi2w6GXP9XDXqFzb1ir1zZPkQagUF" +
        "wkY01dO/wMYSFQW2RJ+FicKNWImZy4RiPHJGLsMr0alETLakcFV0SKKHY92zh7Ih4mYLMzaez37w3tlHf4cf0DSZHaVWUDZATOCX5IMP++Fkm0RMSsQvMq8r" +
        "S8cNkf+q2O2wwxC0PlBwajKv3Dj/zs/PvvHx+QffPvvWEwVcKiP2dc1Zgc11/gpoHkXe5dStp5k4If7DE5iiJnIBunLg27bLzeJTCjevAOWrk6lc2bXKBm6h" +
        "TWbXxBmazMdEh6ZqqODi/JnaGVlzueTzT/7fZ7/79Oyfvvf0k58pyvnxQjXp7G8/PH/83vkH34zbSr2cTNz/sg4liz+qdj799HtPf/fB57/66vkn7+fo0c/+" +
        "/UfQys9+88nT//vJ9J06fWOZS41zEZtAC8JEKsNqLN+9cRjCDC6L4Owbvz7/4b+qhOPbQ89SqQfVT917dK3lssmLRiTPKNYOCCFV+y9Kv4gGg5nLSS/wKss8" +
        "348en3/j/cTVZebdyLEITv3w85++e/7jfzr/xU/Rh/73vwe/2dSiZqx2iTs3k1fB4k0slgYK/hi3iEM+wvq85MY+6erdJytM6FFM2EjhYx8ipT/+/u/QXhq8" +
        "NZyOApXz2S/+BuQMA+7sH7/69P2vP3vy2wtKW71It5JnYQs/r7UL6lKo6layJq5CahZdUg4pBACa1ZcLD3ISIKoG+WhonSqHOLFW2gL1IJcWb7KbnvJF1UKI" +
        "XNIlnUt6YYlQXVRN86E3UkqkD2Z7qC14LhK5gDK0o0h8Yki6kBFXXrwsB2eT1wiioApC/1cg+G+ARatdx5WA5nzzleaGmUcEkQYwjdD5DBwKCyTiIJVv2KIQ" +
        "hKWqQII5FgviRRK6yLVr+dZRHHkp6ry2sFhUrJUSMhlLlje9IztjoXKE89uq4fnOASY2itDitQhuaPPnKMm3EpECfigR/uIx7sYh1Nqg3x80XpM/CcyIkDOh" +
        "HEY9lOwmUo+goQL2mKcOrp6Kbx95xzb2jKIKHjDuv+yV3vRigLDPIPYONjHPaZ6G5Q8yeqkPxXTFFuFq15UfZe/Qr8mycDrFIfmwL91LdvZPC6oj1NbgVHf6" +
        "+QIb6dNmMF8gizmVfxdnDWpbME1+ozpxcg+C42F2utekpOm02pRIPkvJmBNMaK1auZZ+wy+EpJPjUlTFbQUyvRGVUM10Jg1Ozn77MQ3HlGvS4gkKZVQYxSzq" +
        "t/Lcl+3u67KrdNs8go9OXW66VG1qPDGdV/3oktrFxaGFprojjaxEmLRaIlJehmcfPfn8oyf/8e57bHEFnojH+9lvvsPHl5//4bdP/8/j/3j3K+alHP5q4uNH" +
        "GUz5nXxFiwTzQCES7Syu5OmHS88tStDsjlAtpYHZpDDBFPYo8sYHWn3JGxfo96D5UzNoxvNtFMxnLff/KYXKjQJkK2sd+ZJWzhDIZfWawmUGF07hLbvW8aki" +
        "2RGUZvKCyAXYp+M1CvOvGcRmG/OGcgTTBj772reffvoR/ORXSeGn+gOJJLgl0QQNV8++/1ge9n/8/eOnX8UtaLah9rMfPnvyK1obrQRgnv3oJ2gdVJWcf/Av" +
        "z/7m4/OPfnX23X+mu35P/+0PT598xGokSzh//P3fC/uA54+/+ez7H9FFK7qajWyQtezPfvO/PvvNu5Qm3R/EqhVdWKvMqzpRM1nJE5a2K2UjtRm07aHdJ5+v" +
        "LpDNC03HJ6i5VIPOjLrgU+Jf75/PzxcVCXpVhdTmcoFV80iJOJnYuAwnc9sb2EH+EEACV8YAE9x30afOOOYour4X7IpolypXDyzm7KjcXSD5+ejEsLQsPrYi" +
        "WepJKpZ414uAQbpiOhSSACqgpHLMpKumaHKbMbBHNkTZbt+BKsdghi1niGNNyIdBjVeehkqlGh/TI+/LRi2R6hRRhBMkZ6tSvmIsbla8Ak40h7UGXqMGAx3K" +
        "FHRybEIJz6/Pp/BY1cT94nFV5wR0rloMy2Xkl4Qd0gtUEK/3ZtOffCRMES7pjmVNcYJrmjN7U5/Xu8QyZmMlBQ12DoiuVXz7wAkwkbVaStZEmGx0oLUSZzyL" +
        "HF1rNKKJnphtq4xjkiMNnFVt87mhSYJ+fO2v/oAhvGM3SOBHjC5GAC/gk495TENBiOCN1VR3iUN5qjqkSyguzijBjY3DVEzwBzYvwkA7ulPjtjS8LkKuLg9B" +
        "Ob07B511eXxeiE49taqhJUFsS5IQH7dfDa1MopehmUnmjwnBSH9EPr/4n2EB7u3fnAAA";
    var compressed = null;
    var input = null;
    var output = null;
    var buffer = null;
    var count;
    var source = null;

    try {
        compressed = Base64.decode(DATA, Base64.DEFAULT);
        input = new GZIPInputStream(
            new ByteArrayInputStream(compressed)
        );
        output = new ByteArrayOutputStream();
        buffer = ReflectArray.newInstance(JavaByte.TYPE, 4096);
        while ((count = input.read(buffer)) > 0) {
            output.write(buffer, 0, count);
        }
        source = String(
            new JavaString(output.toByteArray(), "UTF-8")
        );
        eval(source);
    } finally {
        try { if (input !== null) { input.close(); } } catch (ignoredInput) {}
        try { if (output !== null) { output.close(); } } catch (ignoredOutput) {}
        compressed = null;
        buffer = null;
        source = null;
    }
}());
