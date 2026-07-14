{
	"patcher" : 	{
		"fileversion" : 1,
		"appversion" : 		{
			"major" : 9,
			"minor" : 0,
			"revision" : 9,
			"architecture" : "x64",
			"modernui" : 1
		}
,
		"classnamespace" : "box",
		"rect" : [ 113.0, -1353.0, 2566.0, 1319.0 ],
		"gridonopen" : 2,
		"gridsize" : [ 15.0, 15.0 ],
		"gridsnaponopen" : 2,
		"integercoordinates" : 1,
		"boxes" : [ 			{
				"box" : 				{
					"fontsize" : 12.0,
					"id" : "obj-title",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 20.0, 520.0, 20.0 ],
					"text" : "MT48 OSC receiver — bridge が /mt48/... を UDP 7400 へ送ってくる"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-udp",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 30.0, 60.0, 130.0, 22.0 ],
					"text" : "udpreceive 7400"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-print-raw",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 200.0, 60.0, 110.0, 22.0 ],
					"text" : "print osc-raw"
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 10.0,
					"id" : "obj-c-raw",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 320.0, 62.0, 400.0, 18.0 ],
					"text" : "← 全 OSC をコンソールへ。使いたいアドレスはここで見つける"
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 11.0,
					"id" : "obj-c-mon",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 110.0, 200.0, 19.0 ],
					"text" : "── モニタリング ──"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-route",
					"maxclass" : "newobj",
					"numinlets" : 4,
					"numoutlets" : 4,
					"outlettype" : [ "", "", "", "" ],
					"patching_rect" : [ 30.0, 135.0, 260.0, 22.0 ],
					"text" : "route /mt48/volume /mt48/mute /mt48/dim"
				}

			}
, 			{
				"box" : 				{
					"format" : 6,
					"id" : "obj-vol-num",
					"maxclass" : "flonum",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "bang" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 30.0, 175.0, 70.0, 22.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-mute-tog",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 115.0, 175.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-dim-tog",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 160.0, 175.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 10.0,
					"id" : "obj-c-spk",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 202.0, 220.0, 18.0 ],
					"text" : "volume(dB)     mute     dim"
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 11.0,
					"id" : "obj-c-btn",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 250.0, 420.0, 19.0 ],
					"text" : "── フロントパネルのボタン（点灯 = 1 / 消灯 = 0）──"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-broute",
					"maxclass" : "newobj",
					"numinlets" : 6,
					"numoutlets" : 6,
					"outlettype" : [ "", "", "", "", "", "" ],
					"patching_rect" : [ 30.0, 275.0, 673.0, 22.0 ],
					"text" : "route /mt48/button/speaker_a /mt48/button/speaker_b /mt48/button/phones_1 /mt48/button/phones_2 /mt48/button/phones_3"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-spk-a",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 30.0, 315.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-spk-b",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 90.0, 315.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-ph-1",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 150.0, 315.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-ph-2",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 210.0, 315.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-ph-3",
					"maxclass" : "toggle",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "int" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 270.0, 315.0, 24.0, 24.0 ]
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 10.0,
					"id" : "obj-c-btn2",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 342.0, 300.0, 18.0 ],
					"text" : "SPK A    SPK B    PH 1     PH 2     PH 3"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-btn-other",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 340.0, 315.0, 150.0, 22.0 ],
					"text" : "print osc-unrouted"
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 10.0,
					"id" : "obj-c-other",
					"linecount" : 2,
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 340.0, 342.0, 640.0, 29.0 ],
					"text" : "← /mt48/button/*/color, /mt48/monitor/..., /mt48/raw/... など。route はアドレス完全一致なので、階層でまとめて拾うには CNMAT の OSC-route を使う"
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 11.0,
					"id" : "obj-c-src",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 400.0, 420.0, 19.0 ],
					"text" : "── モニタリングのソース（入力）──"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-sroute",
					"maxclass" : "newobj",
					"numinlets" : 3,
					"numoutlets" : 3,
					"outlettype" : [ "", "", "" ],
					"patching_rect" : [ 30.0, 425.0, 260.0, 22.0 ],
					"text" : "route /mt48/source /mt48/source/name"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-src-id",
					"maxclass" : "number",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "bang" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 30.0, 465.0, 70.0, 22.0 ]
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-src-set",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 115.0, 425.0, 80.0, 22.0 ],
					"text" : "prepend set"
				}

			}
, 			{
				"box" : 				{
					"id" : "obj-src-name",
					"maxclass" : "message",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 115.0, 465.0, 100.0, 22.0 ]
				}

			}
, 			{
				"box" : 				{
					"fontsize" : 10.0,
					"id" : "obj-c-src2",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 492.0, 300.0, 18.0 ],
					"text" : "source id            source 名 (DAW / AMP)"
				}

			}
 ],
		"lines" : [ 			{
				"patchline" : 				{
					"destination" : [ "obj-btn-other", 0 ],
					"source" : [ "obj-broute", 5 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-ph-1", 0 ],
					"source" : [ "obj-broute", 2 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-ph-2", 0 ],
					"source" : [ "obj-broute", 3 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-ph-3", 0 ],
					"source" : [ "obj-broute", 4 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-spk-a", 0 ],
					"source" : [ "obj-broute", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-spk-b", 0 ],
					"source" : [ "obj-broute", 1 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-dim-tog", 0 ],
					"source" : [ "obj-route", 2 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-mute-tog", 0 ],
					"source" : [ "obj-route", 1 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-vol-num", 0 ],
					"source" : [ "obj-route", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-src-name", 0 ],
					"source" : [ "obj-src-set", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-src-id", 0 ],
					"source" : [ "obj-sroute", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-src-set", 0 ],
					"source" : [ "obj-sroute", 1 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-broute", 0 ],
					"order" : 2,
					"source" : [ "obj-udp", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-print-raw", 0 ],
					"order" : 0,
					"source" : [ "obj-udp", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-route", 0 ],
					"order" : 3,
					"source" : [ "obj-udp", 0 ]
				}

			}
, 			{
				"patchline" : 				{
					"destination" : [ "obj-sroute", 0 ],
					"order" : 1,
					"source" : [ "obj-udp", 0 ]
				}

			}
 ],
		"dependency_cache" : [  ],
		"autosave" : 0
	}

}
